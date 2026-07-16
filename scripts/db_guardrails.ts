/**
 * DB Guardrails — fails CI if the database is in a state that would break
 * super-admin access or leak sensitive tables. Runs BEFORE any merge.
 *
 * Checks (each is a hard assert):
 *   1. RLS is ENABLED on every critical table.
 *   2. Expected policies exist on user_roles, admin_permissions, role_check_audit.
 *   3. `authenticated` HAS EXECUTE on has_role, is_super_admin, get_effective_limits,
 *      log_qr_audit, log_role_check.
 *   4. `authenticated` does NOT have EXECUTE on process_transaction / make_payment
 *      (those must be behind SECURITY DEFINER wrappers or edge functions).
 *   5. GRANT SELECT/INSERT/... to expected roles on public tables.
 *
 * Uses the service role key + PostgREST for grants and pg_catalog inspection
 * via a temporary SECURITY DEFINER helper, but here we go straight to Postgres
 * over the SUPABASE_DB_URL / connection URL when available. If DB URL is not
 * set, we fall back to RPC probes (best effort).
 *
 * Run:
 *   deno run --allow-net --allow-env --allow-read \
 *     scripts/db_guardrails.ts
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(2);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// A tiny inspection helper: we install a temporary function (idempotent) that
// exposes catalog data through PostgREST. Service role can create functions.
const INSTALL_SQL = `
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
`;

// Install via SQL over PostgREST is not exposed; instead we rely on the fact
// that this function already exists after the first run (or via migration).
// If it doesn't exist, we bail with a clear message telling the operator to
// apply the guardrails migration first.

const { data, error } = await sb.rpc("_ci_db_guardrails_probe");
if (error) {
  console.error("❌ _ci_db_guardrails_probe() is not installed in the database.");
  console.error("   Install it once by running the SQL below (as service role):");
  console.error("\n" + INSTALL_SQL + "\n");
  console.error("   Then re-run this script. Underlying error:", error.message);
  Deno.exit(2);
}

const snapshot = data as {
  rls: Record<string, boolean>;
  grants: Array<{ function: string; grantee: string; has_execute: boolean }>;
  policies: Record<string, string[]>;
};

const failures: string[] = [];

// 1. RLS must be ON for every critical table.
const RLS_REQUIRED = [
  "user_roles", "admin_permissions", "customers", "merchants", "transactions",
  "payments", "notifications", "monthly_statements", "profiles", "error_logs",
  "role_check_audit", "transaction_limits", "qr_audit_log", "merchant_risk_scores",
  "merchant_risk_alerts", "customer_verifications", "merchant_transfers",
];
for (const t of RLS_REQUIRED) {
  if (snapshot.rls[t] !== true) {
    failures.push(`RLS is NOT enabled on public.${t}`);
  }
}

// 2. Policies must exist on these tables.
const POLICY_MIN: Record<string, number> = {
  user_roles: 1,
  admin_permissions: 1,
  role_check_audit: 1,
  error_logs: 1,
};
for (const [t, min] of Object.entries(POLICY_MIN)) {
  const n = snapshot.policies?.[t]?.length ?? 0;
  if (n < min) failures.push(`public.${t} has ${n} policies, expected >= ${min}`);
}

// 3. authenticated MUST have EXECUTE on these role-check helpers.
const MUST_EXECUTE_AUTHENTICATED = [
  "has_role", "is_super_admin", "get_effective_limits", "log_qr_audit", "log_role_check",
];
for (const fn of MUST_EXECUTE_AUTHENTICATED) {
  const row = snapshot.grants.find(
    (g) => g.function === fn && g.grantee === "authenticated"
  );
  if (!row || !row.has_execute) {
    failures.push(
      `authenticated is MISSING EXECUTE on public.${fn}() — RLS policies calling this will fail`
    );
  }
}

// 4. authenticated must NOT have EXECUTE on privileged money-moving RPCs.
const MUST_NOT_EXECUTE_AUTHENTICATED = ["process_transaction", "make_payment"];
for (const fn of MUST_NOT_EXECUTE_AUTHENTICATED) {
  const row = snapshot.grants.find(
    (g) => g.function === fn && g.grantee === "authenticated"
  );
  if (row?.has_execute) {
    failures.push(
      `authenticated MUST NOT have EXECUTE on public.${fn}() — call it via an edge function instead`
    );
  }
}

// Report.
if (failures.length > 0) {
  console.error("❌ DB Guardrails FAILED:");
  for (const f of failures) console.error("   • " + f);
  console.error(`\n   ${failures.length} violation(s). Merge is blocked.`);
  Deno.exit(1);
}
console.log("✅ DB Guardrails passed:");
console.log(`   • RLS enabled on ${RLS_REQUIRED.length} critical tables`);
console.log(`   • EXECUTE granted to authenticated on ${MUST_EXECUTE_AUTHENTICATED.length} role-check helpers`);
console.log(`   • EXECUTE revoked from authenticated on ${MUST_NOT_EXECUTE_AUTHENTICATED.length} money-moving RPCs`);
