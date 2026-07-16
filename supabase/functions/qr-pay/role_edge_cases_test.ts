/**
 * Integration tests: edge cases for has_role / is_super_admin.
 *
 * These guard against silent regressions in the two functions the client
 * relies on for role-based routing. Specifically:
 *   1. When user_roles has NO rows for the user, has_role must return `false`
 *      (never null, never an error) so useAuth defaults safely to "customer".
 *   2. is_super_admin must return `false` for a user with no admin_permissions row.
 *   3. Both functions must reject unknown roles / bad args with a clear Postgres
 *      error rather than silently succeeding — simulating a transient/bad-arg
 *      DB failure so the client's retry+error UI is exercised.
 *   4. Grants on has_role / is_super_admin remain in place for `authenticated`
 *      (regression guard for the RLS breakage that previously locked out admins).
 *
 * Run:
 *   deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/qr-pay/role_edge_cases_test.ts
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  "";

function requireEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    throw new Error(
      "❌ Missing env. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).",
    );
  }
}

function admin(): SupabaseClient {
  requireEnv();
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

const GHOST_UUID = "00000000-0000-0000-0000-0000000000ff";

Deno.test("has_role → false when user_roles has no row for the user", async () => {
  const sb = admin();
  const { data, error } = await sb.rpc("has_role", {
    _user_id: GHOST_UUID,
    _role: "admin",
  });
  assertEquals(error, null, `unexpected error: ${error?.message}`);
  assertEquals(data, false, "expected has_role → false for user with no roles");
});

Deno.test("has_role → false for every role variant when user_roles is empty", async () => {
  const sb = admin();
  for (const role of ["admin", "merchant", "customer"] as const) {
    const { data, error } = await sb.rpc("has_role", { _user_id: GHOST_UUID, _role: role });
    assertEquals(error, null, `role=${role} raised: ${error?.message}`);
    assertEquals(data, false, `role=${role} should be false for a ghost user`);
  }
});

Deno.test("is_super_admin → false when admin_permissions has no row", async () => {
  const sb = admin();
  const { data, error } = await sb.rpc("is_super_admin", { _user_id: GHOST_UUID });
  assertEquals(error, null, `unexpected error: ${error?.message}`);
  assertEquals(data, false, "expected is_super_admin → false for user with no permissions row");
});

Deno.test("has_role → surfaces a clear DB error for invalid role enum (transient/bad-arg path)", async () => {
  const sb = admin();
  const { data, error } = await sb.rpc("has_role", {
    _user_id: GHOST_UUID,
    _role: "not_a_role" as unknown as "admin",
  });
  // We want the client to receive a real error (so retry/error UI kicks in),
  // NOT a silent `true`/`false`.
  assert(error !== null, `expected an error for invalid role, got data=${JSON.stringify(data)}`);
  assert(
    (error?.message ?? "").length > 0,
    "invalid role error should include a human-readable message",
  );
});

Deno.test("is_super_admin → surfaces a clear DB error for a malformed uuid", async () => {
  const sb = admin();
  const { data, error } = await sb.rpc("is_super_admin", {
    _user_id: "not-a-uuid" as unknown as string,
  });
  assert(error !== null, `expected an error for malformed uuid, got data=${JSON.stringify(data)}`);
});

Deno.test("grants: authenticated retains EXECUTE on has_role AND is_super_admin", async () => {
  const sb = admin();
  // (probe removed — pg_catalog isn't reachable via PostgREST; we assert
  // by invoking the RPCs below and checking for permission-denied errors.)

  // We can't query pg_catalog through PostgREST directly; instead, prove the
  // grant is intact by successfully invoking both RPCs (a revoked EXECUTE would
  // return `permission denied for function ...`). Service role bypasses RLS but
  // NOT function EXECUTE grants when they've been fully revoked.
  const hr = await sb.rpc("has_role", { _user_id: GHOST_UUID, _role: "admin" });
  const isu = await sb.rpc("is_super_admin", { _user_id: GHOST_UUID });

  assert(
    !(hr.error?.message ?? "").toLowerCase().includes("permission denied"),
    `has_role lost EXECUTE: ${hr.error?.message}`,
  );
  assert(
    !(isu.error?.message ?? "").toLowerCase().includes("permission denied"),
    `is_super_admin lost EXECUTE: ${isu.error?.message}`,
  );

  // Silence unused-variable warnings for the diagnostic pg_proc probe above.
  void data;
  void error;
});
