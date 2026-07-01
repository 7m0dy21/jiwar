
DROP TRIGGER IF EXISTS trigger_sheets_on_customers ON public.customers;
DROP TRIGGER IF EXISTS trigger_sheets_on_merchants ON public.merchants;
DROP TRIGGER IF EXISTS trigger_sheets_on_transactions ON public.transactions;
DROP TRIGGER IF EXISTS trigger_sheets_on_profiles ON public.profiles;
DROP TRIGGER IF EXISTS sync_customers_to_sheets ON public.customers;
DROP TRIGGER IF EXISTS sync_merchants_to_sheets ON public.merchants;
DROP TRIGGER IF EXISTS sync_transactions_to_sheets ON public.transactions;
DROP TRIGGER IF EXISTS sync_profiles_to_sheets ON public.profiles;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _requested text; _role app_role;
BEGIN
  _requested := lower(coalesce(NEW.raw_user_meta_data->>'role', 'customer'));
  IF _requested = 'merchant' THEN _role := 'merchant'::app_role;
  ELSE _role := 'customer'::app_role;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  IF _role = 'merchant'::app_role THEN
    INSERT INTO public.merchants (user_id, store_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', ''));
  ELSE
    INSERT INTO public.customers (user_id, credit_limit, available_balance)
    VALUES (NEW.id, 500, 500);
  END IF;
  RETURN NEW;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_sheets_export() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_financial_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_risk() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_merchant_risk(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_qr_audit(uuid, uuid, text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_dynamic_qr_transaction(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_limits(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_transaction(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_transaction(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.make_payment(uuid, numeric, text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read active merchants basic info" ON public.merchants;

DROP VIEW IF EXISTS public.merchants_public;
CREATE VIEW public.merchants_public
WITH (security_invoker = true) AS
SELECT id, store_name, store_address, is_active, created_at
FROM public.merchants
WHERE is_active = true;
GRANT SELECT ON public.merchants_public TO authenticated, anon;

CREATE POLICY "Authenticated users can read active merchants safe columns"
ON public.merchants FOR SELECT TO authenticated
USING (is_active = true);

REVOKE SELECT ON public.merchants FROM authenticated;
GRANT SELECT (id, user_id, store_name, store_address, is_active, created_at, updated_at)
  ON public.merchants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.merchants TO authenticated;
