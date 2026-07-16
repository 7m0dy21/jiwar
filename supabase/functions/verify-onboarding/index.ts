import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mock KYC/credit/eSign provider integration.
// In production, replace each branch with real Nafath / SIMAH / Nafith calls
// and verify the provider response before persisting.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "غير مصرح" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "غير مصرح" }, 401);
    const userId = claimsData.claims.sub as string;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }
    const step = body?.step;
    if (!["nafath", "simah", "nafith"].includes(step)) {
      return json({ error: "خطوة غير صالحة" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load the caller's customer row; onboarding is per-user
    const { data: customer, error: custErr } = await admin
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (custErr || !customer) {
      await admin.rpc("log_verification_failure", {
        p_customer_id: null,
        p_provider: step,
        p_reason: "لا يوجد حساب عميل",
        p_details: { user_id: userId },
      });
      return json({ error: "لا يوجد حساب عميل" }, 404);
    }
    const customerId = customer.id;

    try {
      if (step === "nafath") {
        // TODO: replace with real Nafath verification result
        await admin.from("customer_verifications").insert({
          customer_id: customerId,
          provider: "nafath",
          status: "approved",
          reference: "NAF-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
          details: { method: "mock", verified_at: new Date().toISOString() },
        });
        await admin.from("customers").update({ nafath_verified: true }).eq("id", customerId);
        return json({ ok: true }, 200);
      }

      if (step === "simah") {
        // TODO: replace with real SIMAH credit-score lookup
        const score = 650 + Math.floor(Math.random() * 200);
        await admin.from("customer_verifications").insert({
          customer_id: customerId,
          provider: "simah",
          status: "approved",
          reference: "SIM-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
          details: { score, method: "mock" },
        });
        await admin.from("customers").update({ simah_score: score }).eq("id", customerId);
        return json({ ok: true, score }, 200);
      }

      // nafith
      await admin.from("customer_verifications").insert({
        customer_id: customerId,
        provider: "nafith",
        status: "approved",
        reference: "NFZ-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        details: { signed_at: new Date().toISOString(), method: "mock" },
      });
      await admin
        .from("customers")
        .update({ nafith_signed: true, onboarding_completed: true })
        .eq("id", customerId);
      return json({ ok: true }, 200);
    } catch (innerErr: any) {
      await admin.rpc("log_verification_failure", {
        p_customer_id: customerId,
        p_provider: step,
        p_reason: innerErr?.message ?? "فشل التحقق",
        p_details: { user_id: userId, error: String(innerErr) },
      });
      return json({ error: innerErr?.message ?? "فشل التحقق" }, 500);
    }
  } catch (err: any) {
    return json({ error: err?.message ?? "خطأ داخلي" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
