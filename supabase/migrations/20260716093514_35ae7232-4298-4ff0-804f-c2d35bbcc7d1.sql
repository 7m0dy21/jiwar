
-- Payment approval requests
CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL,
  merchant_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','failed')),
  transaction_id UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer sees own requests" ON public.payment_requests
  FOR SELECT TO authenticated USING (customer_user_id = auth.uid());
CREATE POLICY "Merchant sees own requests" ON public.payment_requests
  FOR SELECT TO authenticated USING (merchant_user_id = auth.uid());

-- Customers only allowed to update status via RPC (no direct update)
CREATE POLICY "No direct updates" ON public.payment_requests
  FOR UPDATE TO authenticated USING (false);

CREATE TRIGGER payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_requests;
ALTER TABLE public.payment_requests REPLICA IDENTITY FULL;

-- RPC: customer responds to a payment request
CREATE OR REPLACE FUNCTION public.respond_payment_request(p_request_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req payment_requests%ROWTYPE;
  v_tx_id UUID;
  v_err TEXT;
BEGIN
  SELECT * INTO v_req FROM payment_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF v_req.customer_user_id <> auth.uid() THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'الطلب لم يعد قابلاً للرد'; END IF;
  IF v_req.expires_at < now() THEN
    UPDATE payment_requests SET status='expired', reason='انتهت صلاحية الطلب' WHERE id = v_req.id;
    RAISE EXCEPTION 'انتهت صلاحية الطلب';
  END IF;

  IF NOT p_approve THEN
    UPDATE payment_requests SET status='rejected', reason='رفض العميل الطلب' WHERE id = v_req.id;
    INSERT INTO notifications(user_id, title, message, type)
    VALUES (v_req.merchant_user_id, 'تم رفض الدفع', 'رفض العميل طلب دفع بمبلغ ' || v_req.amount || ' ر.س', 'warning');
    RETURN jsonb_build_object('status','rejected');
  END IF;

  -- Approve: process transaction
  BEGIN
    v_tx_id := process_dynamic_qr_transaction(v_req.customer_id, v_req.merchant_user_id, v_req.amount);
    UPDATE payment_requests SET status='approved', transaction_id=v_tx_id, reason='تمت الموافقة' WHERE id = v_req.id;
    RETURN jsonb_build_object('status','approved','transaction_id', v_tx_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    UPDATE payment_requests SET status='failed', reason=v_err WHERE id = v_req.id;
    INSERT INTO notifications(user_id, title, message, type)
    VALUES (v_req.merchant_user_id, 'فشل الدفع', v_err, 'error');
    RAISE EXCEPTION '%', v_err;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_payment_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_payment_request(UUID, BOOLEAN) TO authenticated;
