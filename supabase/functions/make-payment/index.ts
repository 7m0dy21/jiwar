import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "غير مصرح" }, 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "غير مصرح" }, 401);
    const userId = claimsData.claims.sub as string;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }
    const { customer_id, amount, payment_method } = body ?? {};
    if (typeof customer_id !== "string" || typeof amount !== "number" || amount <= 0) {
      return json({ error: "بيانات غير صالحة" }, 400);
    }
    const method = typeof payment_method === "string" && payment_method.length <= 32 ? payment_method : "mada";

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify the caller owns this customer record
    const { data: cust, error: custErr } = await admin
      .from("customers")
      .select("id")
      .eq("id", customer_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (custErr || !cust) return json({ error: "غير مصرح" }, 403);

    const { data: paymentId, error: rpcErr } = await admin.rpc("make_payment", {
      p_customer_id: customer_id,
      p_amount: amount,
      p_payment_method: method,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    return json({ payment_id: paymentId }, 200);
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
