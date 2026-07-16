
-- Revoke EXECUTE from PUBLIC and authenticated on SECURITY DEFINER functions
-- that must not be callable by signed-in users. Trigger functions and
-- privileged RPCs (called via service role / edge functions) are locked down.

REVOKE EXECUTE ON FUNCTION public.trigger_sheets_export() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_merchant_risk(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_financial_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_risk() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._ci_db_guardrails_probe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_transaction(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_dynamic_qr_transaction(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains access for edge functions / triggers.
GRANT EXECUTE ON FUNCTION public.trigger_sheets_export() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_merchant_risk(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_transaction() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_customer_financial_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_recalc_risk() TO service_role;
GRANT EXECUTE ON FUNCTION public._ci_db_guardrails_probe() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_transaction(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.make_payment(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_dynamic_qr_transaction(uuid, uuid, numeric) TO service_role;
