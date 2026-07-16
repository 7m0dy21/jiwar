REVOKE EXECUTE ON FUNCTION public._ci_db_guardrails_probe() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ci_db_guardrails_probe() TO service_role;