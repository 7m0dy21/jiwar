
CREATE OR REPLACE FUNCTION public._ci_db_guardrails_probe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rls JSONB;
  v_grants JSONB;
  v_policies JSONB;
BEGIN
  SELECT jsonb_object_agg(c.relname, c.relrowsecurity)
  INTO v_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  SELECT jsonb_agg(jsonb_build_object(
    'function', p.proname,
    'grantee', r.rolname,
    'has_execute', has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  ))
  INTO v_grants
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN (VALUES ('authenticated'),('anon'),('service_role')) AS r(rolname)
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'has_role','is_super_admin','get_effective_limits','log_qr_audit',
      'log_role_check','process_transaction','make_payment',
      'process_dynamic_qr_transaction'
    );

  SELECT jsonb_object_agg(tablename, policies)
  INTO v_policies
  FROM (
    SELECT tablename, jsonb_agg(policyname ORDER BY policyname) AS policies
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) t;

  RETURN jsonb_build_object('rls', v_rls, 'grants', v_grants, 'policies', v_policies);
END; $$;

REVOKE ALL ON FUNCTION public._ci_db_guardrails_probe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._ci_db_guardrails_probe() TO service_role;
