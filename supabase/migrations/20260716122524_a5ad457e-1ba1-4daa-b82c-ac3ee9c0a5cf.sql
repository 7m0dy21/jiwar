
-- 1. Add pending_balance to merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS pending_balance NUMERIC NOT NULL DEFAULT 0;

-- 2. Add qr_token_hash + idempotency to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS qr_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_transfer_id UUID REFERENCES public.merchant_transfers(id);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_qr_token_hash_uniq
  ON public.transactions(qr_token_hash)
  WHERE qr_token_hash IS NOT NULL;

-- 3. Trigger: keep merchants.pending_balance in sync from transactions
CREATE OR REPLACE FUNCTION public.sync_merchant_pending_from_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    UPDATE public.merchants
      SET pending_balance = pending_balance + NEW.amount
      WHERE id = NEW.merchant_id;
    PERFORM log_qr_audit(NEW.customer_id, NEW.merchant_id, 'ledger_credit', NEW.amount,
      'قيد العملية على رصيد التاجر المعلّق',
      jsonb_build_object('transaction_id', NEW.id, 'qr_token_hash', NEW.qr_token_hash));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
      UPDATE public.merchants
        SET pending_balance = pending_balance + NEW.amount
        WHERE id = NEW.merchant_id;
    ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      UPDATE public.merchants
        SET pending_balance = pending_balance - OLD.amount
        WHERE id = OLD.merchant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_merchant_pending_from_tx ON public.transactions;
CREATE TRIGGER trg_sync_merchant_pending_from_tx
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_merchant_pending_from_tx();

-- 4. Trigger: reduce pending_balance on merchant_transfer completion and stamp transactions
CREATE OR REPLACE FUNCTION public.sync_merchant_pending_from_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed')
     OR (TG_OP = 'UPDATE' AND OLD.status <> 'completed' AND NEW.status = 'completed') THEN
    UPDATE public.merchants
      SET pending_balance = GREATEST(0, pending_balance - NEW.amount)
      WHERE id = NEW.merchant_id;

    UPDATE public.transactions
      SET settled_at = now(),
          settlement_transfer_id = NEW.id
      WHERE merchant_id = NEW.merchant_id
        AND status = 'completed'
        AND settlement_transfer_id IS NULL;

    PERFORM log_qr_audit(NULL, NEW.merchant_id, 'settlement_transfer', NEW.amount,
      'تمت تسوية التاجر عبر تحويل بنكي',
      jsonb_build_object('transfer_id', NEW.id, 'iban', NEW.iban));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_merchant_pending_from_transfer ON public.merchant_transfers;
CREATE TRIGGER trg_sync_merchant_pending_from_transfer
AFTER INSERT OR UPDATE ON public.merchant_transfers
FOR EACH ROW EXECUTE FUNCTION public.sync_merchant_pending_from_transfer();

-- 5. Backfill existing merchants pending_balance
UPDATE public.merchants m SET pending_balance = COALESCE((
  SELECT SUM(t.amount) FROM public.transactions t
  WHERE t.merchant_id = m.id AND t.status = 'completed' AND t.settlement_transfer_id IS NULL
), 0);

-- 6. Upgrade process_dynamic_qr_transaction with idempotency token
CREATE OR REPLACE FUNCTION public.process_dynamic_qr_transaction(
  p_customer_id uuid,
  p_merchant_user_id uuid,
  p_amount numeric,
  p_qr_token_hash text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC; v_tx_id UUID; v_merchant_id UUID; v_customer_user UUID;
  v_cust_per NUMERIC; v_cust_daily NUMERIC; v_cust_monthly NUMERIC;
  v_mer_per NUMERIC; v_mer_daily NUMERIC; v_mer_monthly NUMERIC;
  v_today_cust NUMERIC; v_month_cust NUMERIC;
  v_today_mer NUMERIC; v_month_mer NUMERIC;
  v_reason TEXT;
  v_existing UUID;
BEGIN
  SELECT id INTO v_merchant_id FROM merchants WHERE user_id = p_merchant_user_id;
  IF v_merchant_id IS NULL THEN
    PERFORM log_qr_audit(p_customer_id, NULL, 'rejected', p_amount, 'تاجر غير صالح');
    RAISE EXCEPTION 'تاجر غير صالح';
  END IF;

  -- Idempotency check
  IF p_qr_token_hash IS NOT NULL THEN
    SELECT id INTO v_existing FROM transactions WHERE qr_token_hash = p_qr_token_hash LIMIT 1;
    IF v_existing IS NOT NULL THEN
      PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'idempotent_replay', p_amount,
        'محاولة إعادة استخدام نفس رمز QR - أعيد نفس المعاملة',
        jsonb_build_object('transaction_id', v_existing));
      RETURN v_existing;
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'rejected', p_amount, 'مبلغ غير صالح');
    RAISE EXCEPTION 'المبلغ غير صالح';
  END IF;

  SELECT per_transaction, daily, monthly INTO v_cust_per, v_cust_daily, v_cust_monthly
    FROM get_effective_limits('customer', p_customer_id);
  SELECT per_transaction, daily, monthly INTO v_mer_per, v_mer_daily, v_mer_monthly
    FROM get_effective_limits('merchant', v_merchant_id);

  IF p_amount > v_cust_per THEN
    v_reason := 'تجاوز الحد الأعلى لكل عملية للعميل (' || v_cust_per || ' ر.س)';
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'limit_exceeded', p_amount, v_reason);
    RAISE EXCEPTION '%', v_reason;
  END IF;
  IF p_amount > v_mer_per THEN
    v_reason := 'تجاوز الحد الأعلى لكل عملية للتاجر (' || v_mer_per || ' ر.س)';
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'limit_exceeded', p_amount, v_reason);
    RAISE EXCEPTION '%', v_reason;
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_today_cust FROM transactions
    WHERE customer_id = p_customer_id AND status='completed' AND created_at >= date_trunc('day', now());
  SELECT COALESCE(SUM(amount),0) INTO v_month_cust FROM transactions
    WHERE customer_id = p_customer_id AND status='completed' AND created_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(amount),0) INTO v_today_mer FROM transactions
    WHERE merchant_id = v_merchant_id AND status='completed' AND created_at >= date_trunc('day', now());
  SELECT COALESCE(SUM(amount),0) INTO v_month_mer FROM transactions
    WHERE merchant_id = v_merchant_id AND status='completed' AND created_at >= date_trunc('month', now());

  IF v_today_cust + p_amount > v_cust_daily THEN
    v_reason := 'تجاوز الحد اليومي للعميل (' || v_cust_daily || ' ر.س)';
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'limit_exceeded', p_amount, v_reason);
    RAISE EXCEPTION '%', v_reason;
  END IF;
  IF v_month_cust + p_amount > v_cust_monthly THEN
    v_reason := 'تجاوز الحد الشهري للعميل (' || v_cust_monthly || ' ر.س)';
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'limit_exceeded', p_amount, v_reason);
    RAISE EXCEPTION '%', v_reason;
  END IF;
  IF v_today_mer + p_amount > v_mer_daily THEN
    v_reason := 'تجاوز الحد اليومي للتاجر (' || v_mer_daily || ' ر.س)';
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'limit_exceeded', p_amount, v_reason);
    RAISE EXCEPTION '%', v_reason;
  END IF;
  IF v_month_mer + p_amount > v_mer_monthly THEN
    v_reason := 'تجاوز الحد الشهري للتاجر (' || v_mer_monthly || ' ر.س)';
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'limit_exceeded', p_amount, v_reason);
    RAISE EXCEPTION '%', v_reason;
  END IF;

  SELECT available_balance, user_id INTO v_balance, v_customer_user
    FROM customers WHERE id = p_customer_id FOR UPDATE;
  IF v_balance IS NULL THEN
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'rejected', p_amount, 'العميل غير موجود');
    RAISE EXCEPTION 'العميل غير موجود';
  END IF;
  IF v_balance < p_amount THEN
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'insufficient_balance', p_amount, 'الرصيد غير كافي');
    RAISE EXCEPTION 'الرصيد غير كافي';
  END IF;

  UPDATE customers SET available_balance = available_balance - p_amount WHERE id = p_customer_id;

  BEGIN
    INSERT INTO transactions (customer_id, merchant_id, amount, status, qr_token_hash)
    VALUES (p_customer_id, v_merchant_id, p_amount, 'completed', p_qr_token_hash)
    RETURNING id INTO v_tx_id;
  EXCEPTION WHEN unique_violation THEN
    -- Race: another concurrent scan succeeded, refund and return existing
    UPDATE customers SET available_balance = available_balance + p_amount WHERE id = p_customer_id;
    SELECT id INTO v_existing FROM transactions WHERE qr_token_hash = p_qr_token_hash LIMIT 1;
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'idempotent_race', p_amount,
      'تم اكتشاف تنفيذ متزامن لنفس الرمز - أعيد المعاملة الأصلية',
      jsonb_build_object('transaction_id', v_existing));
    RETURN v_existing;
  END;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (p_merchant_user_id, 'تم استلام دفعة',
    'تم استلام ' || p_amount || ' ر.س من العميل وتقييده في الرصيد المعلّق', 'transaction');

  PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'paid', p_amount, 'تمت العملية بنجاح',
    jsonb_build_object('transaction_id', v_tx_id, 'qr_token_hash', p_qr_token_hash));

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_dynamic_qr_transaction(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_dynamic_qr_transaction(uuid, uuid, numeric, text) TO authenticated, service_role;
