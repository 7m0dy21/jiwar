
CREATE OR REPLACE FUNCTION public.alert_admins_on_verification_failures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fail_count INT;
  v_admin RECORD;
  v_window INTERVAL := INTERVAL '15 minutes';
  v_threshold INT := 3;
  v_recent_alert INT;
BEGIN
  IF NEW.outcome <> 'failure' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_fail_count
  FROM public.verification_audit_log
  WHERE customer_id = NEW.customer_id
    AND outcome = 'failure'
    AND created_at >= now() - v_window;

  IF v_fail_count < v_threshold THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate alerts (one per customer per window)
  SELECT COUNT(*) INTO v_recent_alert
  FROM public.notifications
  WHERE type = 'verification_alert'
    AND metadata->>'customer_id' = NEW.customer_id::text
    AND created_at >= now() - v_window;

  IF v_recent_alert > 0 THEN
    RETURN NEW;
  END IF;

  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications(user_id, title, message, type, channel, delivery_status, metadata)
    VALUES (
      v_admin.user_id,
      'تنبيه: تكرار فشل توثيق',
      'العميل ' || substr(NEW.customer_id::text, 1, 8) || ' فشل التوثيق ' || v_fail_count || ' مرات خلال 15 دقيقة',
      'verification_alert',
      'in_app',
      'queued',
      jsonb_build_object(
        'customer_id', NEW.customer_id,
        'fail_count', v_fail_count,
        'provider', NEW.provider,
        'window_minutes', 15
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_admins_verification_failures ON public.verification_audit_log;
CREATE TRIGGER trg_alert_admins_verification_failures
AFTER INSERT ON public.verification_audit_log
FOR EACH ROW EXECUTE FUNCTION public.alert_admins_on_verification_failures();
