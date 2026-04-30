-- 1. QR Audit Log
CREATE TABLE public.qr_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  merchant_id UUID,
  event_type TEXT NOT NULL, -- generated, paid, expired, invalid_signature, insufficient_balance, limit_exceeded, rejected
  amount NUMERIC,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_audit_customer ON public.qr_audit_log(customer_id, created_at DESC);
CREATE INDEX idx_qr_audit_merchant ON public.qr_audit_log(merchant_id, created_at DESC);
ALTER TABLE public.qr_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own audit" ON public.qr_audit_log FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Merchants read own audit" ON public.qr_audit_log FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "Admins read all audit" ON public.qr_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage audit" ON public.qr_audit_log FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Transaction limits
CREATE TABLE public.transaction_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer','merchant')),
  entity_id UUID NOT NULL,
  per_transaction_limit NUMERIC NOT NULL DEFAULT 1000,
  daily_limit NUMERIC NOT NULL DEFAULT 3000,
  monthly_limit NUMERIC NOT NULL DEFAULT 20000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);
ALTER TABLE public.transaction_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage limits" ON public.transaction_limits FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers read own limits" ON public.transaction_limits FOR SELECT
  USING (entity_type = 'customer' AND entity_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Merchants read own limits" ON public.transaction_limits FOR SELECT
  USING (entity_type = 'merchant' AND entity_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- 3. Helper to log audit (callable by service role / definer)
CREATE OR REPLACE FUNCTION public.log_qr_audit(
  p_customer_id UUID, p_merchant_id UUID, p_event TEXT,
  p_amount NUMERIC DEFAULT NULL, p_reason TEXT DEFAULT NULL, p_metadata JSONB DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO qr_audit_log (customer_id, merchant_id, event_type, amount, reason, metadata)
  VALUES (p_customer_id, p_merchant_id, p_event, p_amount, p_reason, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- 4. Helper to fetch effective limits with defaults
CREATE OR REPLACE FUNCTION public.get_effective_limits(p_entity_type TEXT, p_entity_id UUID)
RETURNS TABLE(per_transaction NUMERIC, daily NUMERIC, monthly NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT per_transaction_limit FROM transaction_limits WHERE entity_type=p_entity_type AND entity_id=p_entity_id), 1000),
    COALESCE((SELECT daily_limit FROM transaction_limits WHERE entity_type=p_entity_type AND entity_id=p_entity_id), 3000),
    COALESCE((SELECT monthly_limit FROM transaction_limits WHERE entity_type=p_entity_type AND entity_id=p_entity_id), 20000);
$$;

-- 5. Update process_dynamic_qr_transaction to enforce limits
CREATE OR REPLACE FUNCTION public.process_dynamic_qr_transaction(
  p_customer_id UUID, p_merchant_user_id UUID, p_amount NUMERIC
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance NUMERIC; v_tx_id UUID; v_merchant_id UUID; v_customer_user UUID;
  v_cust_per NUMERIC; v_cust_daily NUMERIC; v_cust_monthly NUMERIC;
  v_mer_per NUMERIC; v_mer_daily NUMERIC; v_mer_monthly NUMERIC;
  v_today_cust NUMERIC; v_month_cust NUMERIC;
  v_today_mer NUMERIC; v_month_mer NUMERIC;
  v_reason TEXT;
BEGIN
  SELECT id INTO v_merchant_id FROM merchants WHERE user_id = p_merchant_user_id;
  IF v_merchant_id IS NULL THEN
    PERFORM log_qr_audit(p_customer_id, NULL, 'rejected', p_amount, 'تاجر غير صالح');
    RAISE EXCEPTION 'تاجر غير صالح';
  END IF;

  IF p_amount <= 0 THEN
    PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'rejected', p_amount, 'مبلغ غير صالح');
    RAISE EXCEPTION 'المبلغ غير صالح';
  END IF;

  -- Customer limits
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
  INSERT INTO transactions (customer_id, merchant_id, amount, status)
  VALUES (p_customer_id, v_merchant_id, p_amount, 'completed') RETURNING id INTO v_tx_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (p_merchant_user_id, 'تم استلام دفعة', 'تم استلام ' || p_amount || ' ر.س من العميل', 'transaction');

  PERFORM log_qr_audit(p_customer_id, v_merchant_id, 'paid', p_amount, 'تمت العملية بنجاح',
    jsonb_build_object('transaction_id', v_tx_id));

  RETURN v_tx_id;
END; $$;