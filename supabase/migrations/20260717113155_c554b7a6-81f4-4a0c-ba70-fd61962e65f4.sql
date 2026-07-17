
CREATE SEQUENCE IF NOT EXISTS public.customer_account_seq START WITH 1000000001 INCREMENT BY 1;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Backfill existing rows
UPDATE public.customers
SET account_number = LPAD(nextval('public.customer_account_seq')::text, 10, '0')
WHERE account_number IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN account_number SET NOT NULL,
  ALTER COLUMN account_number SET DEFAULT LPAD(nextval('public.customer_account_seq')::text, 10, '0');

CREATE UNIQUE INDEX IF NOT EXISTS customers_account_number_unique ON public.customers(account_number);

-- Protect account_number from being modified by non-admins (extend existing trigger function)
CREATE OR REPLACE FUNCTION public.prevent_customer_financial_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.credit_limit IS DISTINCT FROM OLD.credit_limit THEN RAISE EXCEPTION 'غير مصرح بتعديل حد الائتمان'; END IF;
  IF NEW.available_balance IS DISTINCT FROM OLD.available_balance THEN RAISE EXCEPTION 'غير مصرح بتعديل الرصيد'; END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN RAISE EXCEPTION 'غير مصرح بتعديل حالة التوثيق'; END IF;
  IF NEW.nafath_verified IS DISTINCT FROM OLD.nafath_verified THEN RAISE EXCEPTION 'غير مصرح بتعديل التحقق عبر نفاذ'; END IF;
  IF NEW.simah_score IS DISTINCT FROM OLD.simah_score THEN RAISE EXCEPTION 'غير مصرح بتعديل درجة سمة'; END IF;
  IF NEW.nafith_signed IS DISTINCT FROM OLD.nafith_signed THEN RAISE EXCEPTION 'غير مصرح بتعديل حالة سند نافذ'; END IF;
  IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN RAISE EXCEPTION 'غير مصرح بتعديل حالة اكتمال التسجيل'; END IF;
  IF NEW.qr_code IS DISTINCT FROM OLD.qr_code THEN RAISE EXCEPTION 'غير مصرح بتعديل كود QR'; END IF;
  IF NEW.account_number IS DISTINCT FROM OLD.account_number THEN RAISE EXCEPTION 'غير مصرح بتعديل رقم الحساب'; END IF;

  RETURN NEW;
END;
$function$;
