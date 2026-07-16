
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS qr_token_hash TEXT;

CREATE OR REPLACE FUNCTION public.respond_payment_request(p_request_id uuid, p_approve boolean)
RETURNS jsonb
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
    PERFORM log_qr_audit(v_req.customer_id, v_req.merchant_id, 'request_expired', v_req.amount, 'انتهت صلاحية الطلب', jsonb_build_object('request_id', v_req.id));
    INSERT INTO notifications(user_id, title, message, type)
    VALUES (v_req.merchant_user_id, 'انتهت صلاحية الطلب', 'انتهت صلاحية طلب الدفع قبل رد العميل', 'warning'),
           (v_req.customer_user_id, 'انتهت صلاحية طلب الدفع', 'انتهت صلاحية طلب الدفع - يمكن للتاجر إعادة المحاولة', 'warning');
    RAISE EXCEPTION 'انتهت صلاحية الطلب';
  END IF;

  IF NOT p_approve THEN
    UPDATE payment_requests SET status='rejected', reason='رفض العميل الطلب' WHERE id = v_req.id;
    PERFORM log_qr_audit(v_req.customer_id, v_req.merchant_id, 'request_rejected', v_req.amount, 'رفض العميل الطلب', jsonb_build_object('request_id', v_req.id));
    INSERT INTO notifications(user_id, title, message, type) VALUES
      (v_req.merchant_user_id, 'تم رفض الدفع', 'رفض العميل طلب دفع بمبلغ ' || v_req.amount || ' ر.س', 'warning'),
      (v_req.customer_user_id, 'تم رفض طلب الدفع', 'تم تسجيل رفضك لطلب دفع بمبلغ ' || v_req.amount || ' ر.س', 'info');
    RETURN jsonb_build_object('status','rejected');
  END IF;

  BEGIN
    v_tx_id := process_dynamic_qr_transaction(
      v_req.customer_id, v_req.merchant_user_id, v_req.amount,
      COALESCE(v_req.qr_token_hash, 'req:' || v_req.id::text)
    );
    UPDATE payment_requests SET status='approved', transaction_id=v_tx_id, reason='تمت الموافقة' WHERE id = v_req.id;
    PERFORM log_qr_audit(v_req.customer_id, v_req.merchant_id, 'request_approved', v_req.amount, 'وافق العميل - تمت التسوية', jsonb_build_object('request_id', v_req.id, 'transaction_id', v_tx_id));
    INSERT INTO notifications(user_id, title, message, type) VALUES
      (v_req.customer_user_id, 'تمت الموافقة', 'تمت الموافقة على دفع ' || v_req.amount || ' ر.س وخصمه من رصيدك', 'transaction');
    RETURN jsonb_build_object('status','approved','transaction_id', v_tx_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    UPDATE payment_requests SET status='failed', reason=v_err WHERE id = v_req.id;
    PERFORM log_qr_audit(v_req.customer_id, v_req.merchant_id, 'request_failed', v_req.amount, v_err, jsonb_build_object('request_id', v_req.id));
    INSERT INTO notifications(user_id, title, message, type) VALUES
      (v_req.merchant_user_id, 'فشل الدفع', v_err, 'error'),
      (v_req.customer_user_id, 'فشل تنفيذ الدفع', v_err, 'error');
    RAISE EXCEPTION '%', v_err;
  END;
END;
$$;
