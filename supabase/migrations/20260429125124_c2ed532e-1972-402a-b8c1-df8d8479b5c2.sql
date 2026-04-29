
-- Add onboarding fields to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nafath_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS simah_score INTEGER,
  ADD COLUMN IF NOT EXISTS nafith_signed BOOLEAN NOT NULL DEFAULT false;

-- Customer verifications log
CREATE TABLE IF NOT EXISTS public.customer_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('nafath','simah','nafith')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reference TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own verifications"
  ON public.customer_verifications FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

CREATE POLICY "Customers can insert own verifications"
  ON public.customer_verifications FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

CREATE POLICY "Admins read all verifications"
  ON public.customer_verifications FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage verifications"
  ON public.customer_verifications FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Merchant risk scores
CREATE TABLE IF NOT EXISTS public.merchant_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE,
  score INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'low' CHECK (level IN ('low','medium','high')),
  reason TEXT,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all risk scores"
  ON public.merchant_risk_scores FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage risk scores"
  ON public.merchant_risk_scores FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Merchant risk alerts
CREATE TABLE IF NOT EXISTS public.merchant_risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info','warning','critical')),
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alerts"
  ON public.merchant_risk_alerts FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage alerts"
  ON public.merchant_risk_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_risk_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_risk_scores;

-- Function to recalc merchant risk score
CREATE OR REPLACE FUNCTION public.recalculate_merchant_risk(p_merchant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_volume NUMERIC;
  v_failed INTEGER;
  v_score INTEGER;
  v_level TEXT;
  v_reason TEXT;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount),0),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_volume, v_failed
  FROM transactions WHERE merchant_id = p_merchant_id;

  v_score := LEAST(100, (v_failed * 20) + CASE WHEN v_volume > 50000 THEN 30 ELSE 0 END);
  v_level := CASE WHEN v_score >= 60 THEN 'high' WHEN v_score >= 30 THEN 'medium' ELSE 'low' END;
  v_reason := 'تم احتساب التقييم بناءً على ' || v_total || ' عملية و' || v_failed || ' فشل';

  INSERT INTO merchant_risk_scores (merchant_id, score, level, reason, total_transactions, total_volume, failed_count, updated_at)
  VALUES (p_merchant_id, v_score, v_level, v_reason, v_total, v_volume, v_failed, now())
  ON CONFLICT (merchant_id) DO UPDATE SET
    score = EXCLUDED.score, level = EXCLUDED.level, reason = EXCLUDED.reason,
    total_transactions = EXCLUDED.total_transactions, total_volume = EXCLUDED.total_volume,
    failed_count = EXCLUDED.failed_count, updated_at = now();

  IF v_level = 'high' THEN
    INSERT INTO merchant_risk_alerts (merchant_id, level, message)
    VALUES (p_merchant_id, 'critical', 'مخاطر ائتمانية عالية - مراجعة مطلوبة');
  END IF;
END;
$$;

-- Trigger on transactions to recalc
CREATE OR REPLACE FUNCTION public.trg_recalc_risk()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recalculate_merchant_risk(NEW.merchant_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalc_risk_after_tx ON public.transactions;
CREATE TRIGGER recalc_risk_after_tx
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_risk();

-- Process dynamic QR transaction (called by edge function)
CREATE OR REPLACE FUNCTION public.process_dynamic_qr_transaction(
  p_customer_id UUID,
  p_merchant_user_id UUID,
  p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_tx_id UUID;
  v_merchant_id UUID;
  v_customer_user UUID;
BEGIN
  SELECT id INTO v_merchant_id FROM merchants WHERE user_id = p_merchant_user_id;
  IF v_merchant_id IS NULL THEN RAISE EXCEPTION 'تاجر غير صالح'; END IF;

  IF p_amount <= 0 THEN RAISE EXCEPTION 'المبلغ غير صالح'; END IF;

  SELECT available_balance, user_id INTO v_balance, v_customer_user
  FROM customers WHERE id = p_customer_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'الرصيد غير كافي'; END IF;

  UPDATE customers SET available_balance = available_balance - p_amount WHERE id = p_customer_id;

  INSERT INTO transactions (customer_id, merchant_id, amount, status)
  VALUES (p_customer_id, v_merchant_id, p_amount, 'completed')
  RETURNING id INTO v_tx_id;

  -- Notify merchant
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (p_merchant_user_id, 'تم استلام دفعة', 'تم استلام ' || p_amount || ' ر.س من العميل', 'transaction');

  RETURN v_tx_id;
END;
$$;
