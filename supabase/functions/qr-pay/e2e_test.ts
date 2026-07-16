// End-to-End integration tests for the QR generation (customer) and
// lookup (merchant) flow through the qr-pay Edge Function.
//
// Scenarios covered:
//   1. Happy path — customer generates token, merchant looks it up and
//      receives the correct customer identity + can_pay=true.
//   2. Expired token — timestamp older than TTL is rejected with the
//      Arabic "انتهت صلاحية الكود" message.
//   3. Onboarding incomplete — merchant can still identify the customer
//      but receives can_pay=false with a verification_reason.
//   4. Invalid signature — tampered token is rejected.
//   5. Malformed token — non-JIWAR payload is rejected.
//   6. Stale customer id relink — token carrying an old customer_id but
//      a valid user_id is transparently relinked to the current customer.
//
// Run with the supabase--test_edge_functions tool (Deno test runner).
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
// JIWAR_QR_SECRET (must match the deployed function secret) in the root .env.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const QR_SECRET = Deno.env.get("JIWAR_QR_SECRET") ?? "";

const MISSING_ENV = [
  "❌ Missing env for qr-pay e2e tests. Required in root .env:",
  "   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, JIWAR_QR_SECRET",
].join("\n");

function requireEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !QR_SECRET) {
    throw new Error(MISSING_ENV);
  }
}

function admin(): SupabaseClient {
  requireEnv();
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uuidToCompact(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSignCompact(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64Url(new Uint8Array(sig).slice(0, 20));
}

interface Fixtures {
  customerUserId: string;
  customerId: string;
  customerEmail: string;
  merchantUserId: string;
  merchantId: string;
  merchantEmail: string;
  password: string;
}

async function seed(db: SupabaseClient, opts: { onboarded?: boolean } = {}): Promise<Fixtures> {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const password = "Test12345!";
  const customerEmail = `cust_e2e_${stamp}@jiwar.test`;
  const merchantEmail = `mer_e2e_${stamp}@jiwar.test`;

  const { data: cu, error: cuErr } = await db.auth.admin.createUser({
    email: customerEmail, password, email_confirm: true,
    user_metadata: { full_name: "E2E Customer", role: "customer" },
  });
  if (cuErr) throw cuErr;
  const customerUserId = cu.user!.id;

  const { data: mu, error: muErr } = await db.auth.admin.createUser({
    email: merchantEmail, password, email_confirm: true,
    user_metadata: { full_name: "E2E Merchant", role: "merchant", store_name: "E2E Store" },
  });
  if (muErr) throw muErr;
  const merchantUserId = mu.user!.id;

  const { data: cust } = await db.from("customers").select("id").eq("user_id", customerUserId).single();
  const { data: mer } = await db.from("merchants").select("id").eq("user_id", merchantUserId).single();
  const customerId = cust!.id;
  const merchantId = mer!.id;

  await db.from("customers").update({
    credit_limit: 5000, available_balance: 5000,
    onboarding_completed: opts.onboarded ?? true,
    is_verified: opts.onboarded ?? true,
  }).eq("id", customerId);

  return {
    customerUserId, customerId, customerEmail,
    merchantUserId, merchantId, merchantEmail, password,
  };
}

async function cleanup(db: SupabaseClient, f: Fixtures) {
  await db.from("qr_audit_log").delete().eq("customer_id", f.customerId);
  await db.from("payment_requests").delete().eq("customer_id", f.customerId);
  await db.from("notifications").delete().eq("user_id", f.customerUserId);
  await db.from("notifications").delete().eq("user_id", f.merchantUserId);
  await db.from("customers").delete().eq("id", f.customerId);
  await db.from("merchants").delete().eq("id", f.merchantId);
  await db.auth.admin.deleteUser(f.customerUserId).catch(() => {});
  await db.auth.admin.deleteUser(f.merchantUserId).catch(() => {});
}

async function signIn(email: string, password: string): Promise<string> {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  return data.session.access_token;
}

async function callQrPay(jwt: string, body: unknown): Promise<{ status: number; json: any }> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/qr-pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

Deno.test("env: all required variables are set", () => requireEnv());

Deno.test("E2E happy path: customer generates token → merchant looks it up successfully", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    const custJwt = await signIn(f.customerEmail, f.password);
    const gen = await callQrPay(custJwt, { action: "generate" });
    assertEquals(gen.status, 200);
    assertExists(gen.json.token);
    assertStringIncludes(gen.json.token, "JIWARv3.");

    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token: gen.json.token });
    assertEquals(look.status, 200);
    assertEquals(look.json.customer.id, f.customerId);
    assertEquals(look.json.customer.user_id, f.customerUserId);
    assertEquals(look.json.customer.can_pay, true);
    assertEquals(look.json.customer.verification_reason, null);
  } finally { await cleanup(db, f); }
});

Deno.test("E2E expired token: merchant lookup fails with expiry message", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    // Forge a compact v3 token with a past timestamp (>TTL=60s ago)
    const ts = Math.floor(Date.now() / 1000) - 120;
    const customerId = uuidToCompact(f.customerId);
    const userId = uuidToCompact(f.customerUserId);
    const ts36 = ts.toString(36);
    const payload = `${customerId}.${userId}.${ts36}`;
    const sig = await hmacSignCompact(payload, QR_SECRET);
    const token = `JIWARv3.${customerId}.${userId}.${ts36}.${sig}`;

    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token });
    assertEquals(look.status, 400);
    assertStringIncludes(look.json.error, "انتهت صلاحية");
  } finally { await cleanup(db, f); }
});

Deno.test("E2E onboarding incomplete: merchant identifies customer but can_pay=false", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: false });
  try {
    const custJwt = await signIn(f.customerEmail, f.password);
    const gen = await callQrPay(custJwt, { action: "generate" });
    assertEquals(gen.status, 200);

    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token: gen.json.token });
    assertEquals(look.status, 200);
    assertEquals(look.json.customer.id, f.customerId);
    assertEquals(look.json.customer.can_pay, false);
    assertExists(look.json.customer.verification_reason);

    // A pay attempt at this stage must be blocked with the verification error.
    const pay = await callQrPay(merJwt, { action: "pay", token: gen.json.token, amount: 50 });
    assertEquals(pay.status, 400);
    assertStringIncludes(pay.json.error, "التحقق");
  } finally { await cleanup(db, f); }
});

Deno.test("E2E invalid signature: tampered token is rejected", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    const custJwt = await signIn(f.customerEmail, f.password);
    const gen = await callQrPay(custJwt, { action: "generate" });
    const parts = String(gen.json.token).split(".");
    // Flip a byte in the signature (last segment)
    const sig = parts[parts.length - 1];
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    parts[parts.length - 1] = flipped;
    const tampered = parts.join(".");

    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token: tampered });
    assertEquals(look.status, 400);
    assertStringIncludes(look.json.error, "توقيع");
  } finally { await cleanup(db, f); }
});

Deno.test("E2E malformed token: non-JIWARv2 payload is rejected", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token: "NOT_A_VALID_TOKEN" });
    assertEquals(look.status, 400);
    assertStringIncludes(look.json.error, "غير صالح");
  } finally { await cleanup(db, f); }
});

Deno.test("E2E stale customer_id relink: merchant still identifies customer via user_id", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    // Forge a compact v3 token that points to a NON-existent customer_id but the real user_id.
    // The resolveCustomer fallback should relink via user_id.
    const fakeCustomerId = uuidToCompact("00000000-0000-0000-0000-000000000000");
    const userId = uuidToCompact(f.customerUserId);
    const ts = Math.floor(Date.now() / 1000);
    const ts36 = ts.toString(36);
    const payload = `${fakeCustomerId}.${userId}.${ts36}`;
    const sig = await hmacSignCompact(payload, QR_SECRET);
    const token = `JIWARv3.${fakeCustomerId}.${userId}.${ts36}.${sig}`;

    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token });
    assertEquals(look.status, 200);
    assertEquals(look.json.customer.id, f.customerId);
    assertEquals(look.json.customer.user_id, f.customerUserId);
    assertEquals(look.json.customer.can_pay, true);
  } finally { await cleanup(db, f); }
});

Deno.test("E2E unauthorized: missing JWT is rejected", async () => {
  requireEnv();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/qr-pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ action: "generate" }),
  });
  const json = await resp.json().catch(() => ({}));
  assertEquals(resp.status, 401);
  assertStringIncludes(String(json.error ?? ""), "Unauthorized");
});

Deno.test("E2E near-expiry: token scanned in the last seconds of TTL still succeeds", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    // Forge a token 58s old (TTL=60s) — represents a merchant scanning right
    // before expiry. Must NOT return "كود غير صالح" or "انتهت صلاحية".
    const ts = Math.floor(Date.now() / 1000) - 58;
    const customerId = uuidToCompact(f.customerId);
    const userId = uuidToCompact(f.customerUserId);
    const ts36 = ts.toString(36);
    const payload = `${customerId}.${userId}.${ts36}`;
    const sig = await hmacSignCompact(payload, QR_SECRET);
    const token = `JIWARv3.${customerId}.${userId}.${ts36}.${sig}`;

    const merJwt = await signIn(f.merchantEmail, f.password);
    const look = await callQrPay(merJwt, { action: "lookup", token });
    assertEquals(look.status, 200, `expected 200, got ${look.status}: ${JSON.stringify(look.json)}`);
    assertEquals(look.json.customer.can_pay, true);
  } finally { await cleanup(db, f); }
});

Deno.test("E2E auto-regeneration: newly-refreshed token is accepted immediately without 'كود غير صالح'", async () => {
  const db = admin();
  const f = await seed(db, { onboarded: true });
  try {
    const custJwt = await signIn(f.customerEmail, f.password);

    // Simulate the client's proactive refresh: generate a first token, then
    // (as if 8s before expiry) generate a second token. Both must lookup OK
    // while inside their TTL window — no "كود غير صالح" between refreshes.
    const first = await callQrPay(custJwt, { action: "generate" });
    assertEquals(first.status, 200);
    assertStringIncludes(first.json.token, "JIWARv3.");

    const second = await callQrPay(custJwt, { action: "generate" });
    assertEquals(second.status, 200);
    assertStringIncludes(second.json.token, "JIWARv3.");

    const merJwt = await signIn(f.merchantEmail, f.password);

    // Scan the freshly-regenerated token (what the merchant now sees on screen).
    const look2 = await callQrPay(merJwt, { action: "lookup", token: second.json.token });
    assertEquals(look2.status, 200, `regenerated token rejected: ${JSON.stringify(look2.json)}`);
    assertEquals(look2.json.customer.can_pay, true);

    // The previous token is still within TTL, so it must also validate — proves
    // the refresh boundary produces no transient "invalid" state.
    const look1 = await callQrPay(merJwt, { action: "lookup", token: first.json.token });
    assertEquals(look1.status, 200, `pre-refresh token rejected: ${JSON.stringify(look1.json)}`);
    assertEquals(look1.json.customer.can_pay, true);
  } finally { await cleanup(db, f); }
});
