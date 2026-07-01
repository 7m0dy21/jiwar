// Deno tests for transaction limit enforcement in process_dynamic_qr_transaction RPC.
// Run with: supabase functions test (or deno test --allow-net --allow-env)
//
// These tests use the SERVICE ROLE key to bypass RLS and seed/cleanup data,
// then exercise the RPC under different limit scenarios:
//   1. per-transaction limit (customer)
//   2. per-transaction limit (merchant)
//   3. daily cumulative limit (customer)
//   4. monthly cumulative limit (customer)
//   5. insufficient balance
//   6. invalid amount (<= 0)
//   7. happy path under limits
//   8. audit log records limit_exceeded events

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Env resolution: prefer explicit test vars, fall back to the standard
// Supabase server-side names, then the Vite public names from the root .env.
const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("VITE_SUPABASE_URL") ??
  "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

// Single source of truth for the "missing env" error so every test fails
// with the exact same actionable message instead of a generic null deref.
const MISSING_ENV_MSG = [
  "❌ Missing required environment variables for qr-pay limit tests.",
  "   Required:",
  "     - SUPABASE_URL              (or VITE_SUPABASE_URL)",
  "     - SUPABASE_SERVICE_ROLE_KEY (service role key, NOT the anon key)",
  "   Add them to your root .env file or export them before running the tests.",
  "   Example .env entries:",
  "     SUPABASE_URL=https://<project-ref>.supabase.co",
  "     SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...",
].join("\n");

function requireEnv(): void {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(MISSING_ENV_MSG);
  }
}

function admin(): SupabaseClient {
  requireEnv();
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// Sanity-check test: runs first and fails loudly (with the full guidance
// message) when env vars are missing, so the rest of the failures are
// self-explanatory instead of cascading noise.
Deno.test("env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured", () => {
  requireEnv();
});

interface Fixtures {
  customerUserId: string;
  customerId: string;
  merchantUserId: string;
  merchantId: string;
}

async function seed(db: SupabaseClient, opts: {
  creditLimit?: number;
  custPer?: number; custDaily?: number; custMonthly?: number;
  merPer?: number; merDaily?: number; merMonthly?: number;
}): Promise<Fixtures> {
  const stamp = Date.now();
  // Create customer auth user
  const { data: cu, error: cuErr } = await db.auth.admin.createUser({
    email: `cust_${stamp}@jiwar.test`, password: "Test12345!", email_confirm: true,
    user_metadata: { full_name: "Test Customer", role: "customer" },
  });
  if (cuErr) throw cuErr;
  const customerUserId = cu.user!.id;

  // Create merchant auth user
  const { data: mu, error: muErr } = await db.auth.admin.createUser({
    email: `mer_${stamp}@jiwar.test`, password: "Test12345!", email_confirm: true,
    user_metadata: { full_name: "Test Merchant", role: "merchant", store_name: "Test Store" },
  });
  if (muErr) throw muErr;
  const merchantUserId = mu.user!.id;

  // handle_new_user trigger created customers/merchants rows; fetch them
  const { data: cust } = await db.from("customers").select("id").eq("user_id", customerUserId).single();
  const { data: mer } = await db.from("merchants").select("id").eq("user_id", merchantUserId).single();
  const customerId = cust!.id;
  const merchantId = mer!.id;

  // Set credit balance
  const credit = opts.creditLimit ?? 100000;
  await db.from("customers").update({
    credit_limit: credit, available_balance: credit, onboarding_completed: true, is_verified: true,
  }).eq("id", customerId);

  // Set custom limits if provided
  if (opts.custPer || opts.custDaily || opts.custMonthly) {
    await db.from("transaction_limits").upsert({
      entity_type: "customer", entity_id: customerId,
      per_transaction_limit: opts.custPer ?? 1000,
      daily_limit: opts.custDaily ?? 3000,
      monthly_limit: opts.custMonthly ?? 20000,
    }, { onConflict: "entity_type,entity_id" } as any);
  }
  if (opts.merPer || opts.merDaily || opts.merMonthly) {
    await db.from("transaction_limits").upsert({
      entity_type: "merchant", entity_id: merchantId,
      per_transaction_limit: opts.merPer ?? 1000,
      daily_limit: opts.merDaily ?? 3000,
      monthly_limit: opts.merMonthly ?? 20000,
    }, { onConflict: "entity_type,entity_id" } as any);
  }

  return { customerUserId, customerId, merchantUserId, merchantId };
}

async function cleanup(db: SupabaseClient, f: Fixtures) {
  await db.from("qr_audit_log").delete().eq("customer_id", f.customerId);
  await db.from("transactions").delete().eq("customer_id", f.customerId);
  await db.from("transaction_limits").delete().eq("entity_id", f.customerId);
  await db.from("transaction_limits").delete().eq("entity_id", f.merchantId);
  await db.from("notifications").delete().eq("user_id", f.customerUserId);
  await db.from("notifications").delete().eq("user_id", f.merchantUserId);
  await db.from("customers").delete().eq("id", f.customerId);
  await db.from("merchants").delete().eq("id", f.merchantId);
  await db.auth.admin.deleteUser(f.customerUserId).catch(() => {});
  await db.auth.admin.deleteUser(f.merchantUserId).catch(() => {});
}

async function callRpc(db: SupabaseClient, f: Fixtures, amount: number) {
  return await db.rpc("process_dynamic_qr_transaction", {
    p_customer_id: f.customerId,
    p_merchant_user_id: f.merchantUserId,
    p_amount: amount,
  });
}

async function lastAuditEvent(db: SupabaseClient, customerId: string): Promise<string | null> {
  const { data } = await db.from("qr_audit_log").select("event_type")
    .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.event_type ?? null;
}

Deno.test("happy path: amount within all limits succeeds", async () => {
  const db = admin();
  const f = await seed(db, { custPer: 500, merPer: 500 });
  try {
    const { data, error } = await callRpc(db, f, 200);
    assertEquals(error, null);
    assertExists(data);
    assertEquals(await lastAuditEvent(db, f.customerId), "paid");
  } finally { await cleanup(db, f); }
});

Deno.test("rejects amount exceeding customer per-transaction limit", async () => {
  const db = admin();
  const f = await seed(db, { custPer: 100, merPer: 5000 });
  try {
    const { error } = await callRpc(db, f, 200);
    assertExists(error);
    assertEquals(/الحد الأعلى لكل عملية للعميل/.test(error!.message), true);
    assertEquals(await lastAuditEvent(db, f.customerId), "limit_exceeded");
  } finally { await cleanup(db, f); }
});

Deno.test("rejects amount exceeding merchant per-transaction limit", async () => {
  const db = admin();
  const f = await seed(db, { custPer: 5000, merPer: 100 });
  try {
    const { error } = await callRpc(db, f, 200);
    assertExists(error);
    assertEquals(/الحد الأعلى لكل عملية للتاجر/.test(error!.message), true);
    assertEquals(await lastAuditEvent(db, f.customerId), "limit_exceeded");
  } finally { await cleanup(db, f); }
});

Deno.test("rejects when cumulative daily customer limit would be exceeded", async () => {
  const db = admin();
  const f = await seed(db, { custPer: 500, custDaily: 800, merPer: 5000, merDaily: 100000 });
  try {
    // First tx OK (500), second should exceed 800 daily
    const r1 = await callRpc(db, f, 500);
    assertEquals(r1.error, null);
    const r2 = await callRpc(db, f, 400);
    assertExists(r2.error);
    assertEquals(/الحد اليومي للعميل/.test(r2.error!.message), true);
    assertEquals(await lastAuditEvent(db, f.customerId), "limit_exceeded");
  } finally { await cleanup(db, f); }
});

Deno.test("rejects when monthly customer limit would be exceeded", async () => {
  const db = admin();
  // Per-tx 1000, daily 100k so daily doesn't trip; monthly 1500 to trip on 2nd tx
  const f = await seed(db, {
    custPer: 1000, custDaily: 100000, custMonthly: 1500,
    merPer: 5000, merDaily: 100000, merMonthly: 100000,
  });
  try {
    const r1 = await callRpc(db, f, 1000);
    assertEquals(r1.error, null);
    const r2 = await callRpc(db, f, 600);
    assertExists(r2.error);
    assertEquals(/الحد الشهري للعميل/.test(r2.error!.message), true);
  } finally { await cleanup(db, f); }
});

Deno.test("rejects when customer balance is insufficient", async () => {
  const db = admin();
  const f = await seed(db, { creditLimit: 50, custPer: 1000, merPer: 1000 });
  try {
    const { error } = await callRpc(db, f, 100);
    assertExists(error);
    assertEquals(/الرصيد غير كافي/.test(error!.message), true);
    assertEquals(await lastAuditEvent(db, f.customerId), "insufficient_balance");
  } finally { await cleanup(db, f); }
});

Deno.test("rejects invalid (zero/negative) amount", async () => {
  const db = admin();
  const f = await seed(db, {});
  try {
    const { error } = await callRpc(db, f, 0);
    assertExists(error);
    assertEquals(/المبلغ غير صالح/.test(error!.message), true);
  } finally { await cleanup(db, f); }
});

Deno.test("rejects when merchant_user_id is unknown", async () => {
  const db = admin();
  const f = await seed(db, {});
  try {
    const { error } = await db.rpc("process_dynamic_qr_transaction", {
      p_customer_id: f.customerId,
      p_merchant_user_id: "00000000-0000-0000-0000-000000000000",
      p_amount: 50,
    });
    assertExists(error);
    assertEquals(/تاجر غير صالح/.test(error!.message), true);
  } finally { await cleanup(db, f); }
});

Deno.test("balance is decremented exactly by the amount on success", async () => {
  const db = admin();
  const f = await seed(db, { creditLimit: 1000, custPer: 1000, merPer: 1000 });
  try {
    const { error } = await callRpc(db, f, 250);
    assertEquals(error, null);
    const { data: cust } = await db.from("customers").select("available_balance").eq("id", f.customerId).single();
    assertEquals(Number(cust!.available_balance), 750);
  } finally { await cleanup(db, f); }
});
