import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_SECONDS = 60;

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SECRET = Deno.env.get("JIWAR_QR_SECRET");
    if (!SECRET) throw new Error("JIWAR_QR_SECRET missing");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const body = await req.json();
    const action = body.action;

    if (action === "generate") {
      // Customer generates QR token
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: customer } = await admin.from("customers").select("id").eq("user_id", userId).single();
      if (!customer) {
        return new Response(JSON.stringify({ error: "ليس لديك حساب عميل" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ts = Math.floor(Date.now() / 1000);
      const payload = `${customer.id}.${ts}`;
      const sig = await hmacSign(payload, SECRET);
      const token = `JIWARv2.${customer.id}.${ts}.${sig}`;
      return new Response(JSON.stringify({ token, ttl: TTL_SECONDS, expires_at: ts + TTL_SECONDS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pay") {
      // Merchant scans + amount
      const { token, amount } = body;
      if (!token || typeof token !== "string") throw new Error("token مطلوب");
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) throw new Error("المبلغ غير صالح");

      const parts = token.split(".");
      if (parts.length !== 4 || parts[0] !== "JIWARv2") throw new Error("كود غير صالح");
      const [, customerId, tsStr, sig] = parts;
      const ts = parseInt(tsStr, 10);
      if (!ts) throw new Error("كود غير صالح");

      const now = Math.floor(Date.now() / 1000);
      if (now - ts > TTL_SECONDS) {
        return new Response(JSON.stringify({ error: "انتهت صلاحية الكود - اطلب من العميل تحديثه" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expectedSig = await hmacSign(`${customerId}.${ts}`, SECRET);
      if (expectedSig !== sig) throw new Error("توقيع غير صالح");

      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: txId, error } = await admin.rpc("process_dynamic_qr_transaction", {
        p_customer_id: customerId,
        p_merchant_user_id: userId,
        p_amount: numAmount,
      });
      if (error) throw new Error(error.message);

      // Notify customer
      const { data: cust } = await admin.from("customers").select("user_id").eq("id", customerId).single();
      if (cust?.user_id) {
        await admin.from("notifications").insert({
          user_id: cust.user_id, title: "عملية شراء جديدة",
          message: `تم خصم ${numAmount} ر.س من رصيدك`, type: "transaction",
        });
      }

      return new Response(JSON.stringify({ success: true, transaction_id: txId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("action غير صالح");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطأ";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
