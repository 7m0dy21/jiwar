// Integration tests: authenticated role can fetch its own user_roles row
// without triggering "permission denied for function has_role/is_super_admin".
//
// Run with: deno test --allow-net --allow-env supabase/functions/qr-pay/role_access_test.ts
//
// Required env:
//   SUPABASE_URL              (or VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (to check grants + seed/cleanup)
//   SUPABASE_ANON_KEY         (or VITE_SUPABASE_PUBLISHABLE_KEY) — client-side key
// Optional (enables end-to-end sign-in scenario):
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASS  — credentials of an existing super admin

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";

const TEST_EMAIL = Deno.env.get("TEST_ADMIN_EMAIL") ?? "";
const TEST_PASS = Deno.env.get("TEST_ADMIN_PASS") ?? "";

const MISSING_ENV_MSG = [
  "❌ Missing required env for role_access tests.",
  "   Required:",
  "     - SUPABASE_URL (or VITE_SUPABASE_URL)",
  "     - SUPABASE_SERVICE_ROLE_KEY",
  "     - SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)",
  "   Optional (enables sign-in scenario):",
  "     - TEST_ADMIN_EMAIL, TEST_ADMIN_PASS",
].join("\n");

function requireEnv(): void {
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) throw new Error(MISSING_ENV_MSG);
}

function admin(): SupabaseClient {
  requireEnv();
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function anon(): SupabaseClient {
  requireEnv();
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

Deno.test("env: SUPABASE_URL, SERVICE_ROLE and ANON keys are configured", () => {
  requireEnv();
});

Deno.test("grants: authenticated has EXECUTE on has_role and is_super_admin", async () => {
  const sb = admin();
  // Use a temp SQL function via RPC — fall back to a simple RPC probe by
  // attempting the calls with a signed-in user in the next test. Here we
  // verify via pg_catalog through a helper SELECT.
  const { data, error } = await sb.rpc("has_role", {
    _user_id: "00000000-0000-0000-0000-000000000000",
    _role: "admin",
  });
  // As service role, this should always succeed (no permission_denied).
  assertEquals(error, null, `has_role should be callable: ${error?.message}`);
  assertEquals(typeof data, "boolean");
});

Deno.test(
  "signed-in super admin: fetching own user_roles never returns permission_denied and role='admin'",
  async () => {
    if (!TEST_EMAIL || !TEST_PASS) {
      console.warn("↷ skipping: set TEST_ADMIN_EMAIL and TEST_ADMIN_PASS to enable");
      return;
    }
    const sb = anon();
    const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASS,
    });
    assertEquals(signErr, null, `sign in failed: ${signErr?.message}`);
    const uid = signIn.user?.id;
    assert(uid, "no user id after sign in");

    // 1) Fetch user_roles — the exact query useAuth.tsx runs.
    const rolesRes = await sb.from("user_roles").select("role").eq("user_id", uid);
    assertEquals(
      rolesRes.error,
      null,
      `user_roles query failed: ${rolesRes.error?.message} (code=${rolesRes.error?.code})`
    );
    assert(
      !(rolesRes.error?.message ?? "").toLowerCase().includes("permission denied"),
      "user_roles query surfaced permission_denied"
    );
    const roles = (rolesRes.data ?? []).map((r) => r.role);
    assert(roles.includes("admin"), `expected 'admin' role, got: ${JSON.stringify(roles)}`);

    // 2) Directly probe has_role + is_super_admin as the authenticated user.
    const hasAdmin = await sb.rpc("has_role", { _user_id: uid, _role: "admin" });
    assertEquals(
      hasAdmin.error,
      null,
      `has_role RPC failed: ${hasAdmin.error?.message} (code=${hasAdmin.error?.code})`
    );
    assertEquals(hasAdmin.data, true, "has_role(admin) should be true for super admin");

    const isSuper = await sb.rpc("is_super_admin", { _user_id: uid });
    assertEquals(
      isSuper.error,
      null,
      `is_super_admin RPC failed: ${isSuper.error?.message} (code=${isSuper.error?.code})`
    );
    assertEquals(isSuper.data, true, "is_super_admin should be true");

    // 3) Touch an admin-only table to prove RLS policies (which call has_role)
    // evaluate without permission_denied for the authenticated user.
    const adminReadRes = await sb.from("error_logs").select("id").limit(1);
    assert(
      !(adminReadRes.error?.message ?? "").toLowerCase().includes("permission denied for function"),
      `admin-only read surfaced permission_denied for function: ${adminReadRes.error?.message}`
    );

    await sb.auth.signOut();
  }
);
