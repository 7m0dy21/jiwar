CREATE OR REPLACE FUNCTION public._ci_security_scan_probe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_tables JSONB;
  v_definers JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'rls_enabled', c.relrowsecurity,
    'policy_count', (
      SELECT COUNT(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    )
  ) ORDER BY c.relname)
  INTO v_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  SELECT jsonb_agg(jsonb_build_object(
    'function', p.proname,
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'public_execute', has_function_privilege('public', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) ORDER BY p.proname)
  INTO v_definers
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef = true;

  RETURN jsonb_build_object('tables', v_tables, 'security_definer_functions', v_definers);
END; $$;

REVOKE ALL ON FUNCTION public._ci_security_scan_probe() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ci_security_scan_probe() FROM anon;
REVOKE ALL ON FUNCTION public._ci_security_scan_probe() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._ci_security_scan_probe() TO service_role;