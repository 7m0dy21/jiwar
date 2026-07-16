
-- 1. Kill the static QR code path FIRST (before tightening the update trigger)
DROP TRIGGER IF EXISTS protect_customer_financial_fields ON public.customers;
DROP TRIGGER IF EXISTS auto_set_qr_code_trigger ON public.customers;
DROP TRIGGER IF EXISTS trg_auto_set_qr_code ON public.customers;
DROP TRIGGER IF EXISTS set_qr_code ON public.customers;
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.customers'::regclass
      AND NOT tgisinternal
      AND pg_get_triggerdef(oid) ILIKE '%auto_set_qr_code%'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.customers', r.tgname);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.auto_set_qr_code() CASCADE;
UPDATE public.customers SET qr_code = NULL WHERE qr_code IS NOT NULL;

-- 2. Protect additional financial/verification fields from client updates
CREATE OR REPLACE FUNCTION public.prevent_customer_financial_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.credit_limit IS DISTINCT FROM OLD.credit_limit THEN
    RAISE EXCEPTION 'غير مصرح بتعديل حد الائتمان';
  END IF;
  IF NEW.available_balance IS DISTINCT FROM OLD.available_balance THEN
    RAISE EXCEPTION 'غير مصرح بتعديل الرصيد';
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'غير مصرح بتعديل حالة التوثيق';
  END IF;
  IF NEW.nafath_verified IS DISTINCT FROM OLD.nafath_verified THEN
    RAISE EXCEPTION 'غير مصرح بتعديل التحقق عبر نفاذ';
  END IF;
  IF NEW.simah_score IS DISTINCT FROM OLD.simah_score THEN
    RAISE EXCEPTION 'غير مصرح بتعديل درجة سمة';
  END IF;
  IF NEW.nafith_signed IS DISTINCT FROM OLD.nafith_signed THEN
    RAISE EXCEPTION 'غير مصرح بتعديل حالة سند نافذ';
  END IF;
  IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN
    RAISE EXCEPTION 'غير مصرح بتعديل حالة اكتمال التسجيل';
  END IF;
  IF NEW.qr_code IS DISTINCT FROM OLD.qr_code THEN
    RAISE EXCEPTION 'غير مصرح بتعديل كود QR';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_customer_financial_fields
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_financial_update();

-- 3. Block clients from inserting verification rows directly
DROP POLICY IF EXISTS "Customers can insert own verifications" ON public.customer_verifications;

-- 4. Revoke SECURITY DEFINER RPCs from signed-in callers
REVOKE EXECUTE ON FUNCTION public.process_transaction(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- 5. Merchant safe-view: expose only non-financial columns to authenticated users
DROP POLICY IF EXISTS "Authenticated users can read active merchants safe columns" ON public.merchants;

DROP VIEW IF EXISTS public.merchants_public;
CREATE VIEW public.merchants_public
WITH (security_invoker = true) AS
SELECT id, store_name, store_address, location_lat, location_lng, is_active, created_at
FROM public.merchants
WHERE is_active = true;

GRANT SELECT ON public.merchants_public TO authenticated, anon;
