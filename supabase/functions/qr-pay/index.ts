import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_SECONDS = 60;

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SECRET = Deno.env.get("JIWAR_QR_SECRET");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const logAudit = async (customerId: string | null, merchantId: string | null, event: string, amount: number | null, reason: string | null, metadata: any = null) => {
    try {
      await admin.rpc("log_qr_audit", {
        p_customer_id: customerId, p_merchant_id: merchantId,
        p_event: event, p_amount: amount, p_reason: reason, p_metadata: metadata,
      });
    } catch (_) { /* swallow audit errors */ }
  };

  try {
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
      await logAudit(customer.id, null, "generated", null, "تم توليد كود ديناميكي", { ttl: TTL_SECONDS });
      return new Response(JSON.stringify({ token, ttl: TTL_SECONDS, expires_at: ts + TTL_SECONDS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "lookup") {
      const { token } = body;
      if (!token || typeof token !== "string") throw new Error("token مطلوب");
      const parts = token.split(".");
      if (parts.length !== 4 || parts[0] !== "JIWARv2") {
        await logAudit(null, null, "invalid_signature", null, "صيغة كود غير صحيحة (lookup)");
        throw new Error("كود غير صالح");
      }
      const [, customerId, tsStr, sig] = parts;
      const ts = parseInt(tsStr, 10);
      if (!ts) throw new Error("كود غير صالح");
      const { data: mer } = await admin.from("merchants").select("id").eq("user_id", userId).maybeSingle();
      if (!mer) throw new Error("حساب التاجر غير موجود - سجّل دخول من حساب تاجر");
      const now = Math.floor(Date.now() / 1000);
      if (now - ts > TTL_SECONDS) {
        await logAudit(customerId, mer.id, "expired", null, "انتهت صلاحية الكود (lookup)");
        throw new Error("انتهت صلاحية الكود - اطلب من العميل تحديثه");
      }
      const expectedSig = await hmacSign(`${customerId}.${ts}`, SECRET);
      if (expectedSig !== sig) {
        await logAudit(customerId, mer.id, "invalid_signature", null, "توقيع غير صالح (lookup)");
        throw new Error("توقيع غير صالح");
      }
      const { data: cust, error: custErr } = await admin
        .from("customers")
        .select("id, available_balance, credit_limit, user_id, onboarding_completed")
        .eq("id", customerId).maybeSingle();
      if (custErr) {
        await logAudit(customerId, mer.id, "lookup_error", null, custErr.message);
        throw new Error("تعذر قراءة بيانات العميل");
      }
      if (!cust) {
        await logAudit(customerId, mer.id, "customer_not_found", null, "معرّف العميل في الكود غير موجود");
        throw new Error("العميل غير موجود - قد يكون الكود قديماً أو الحساب محذوفاً");
      }
      if (!cust.onboarding_completed) {
        await logAudit(customerId, mer.id, "onboarding_incomplete", null, "لم يكمل العميل التحقق");
        throw new Error("لم يكمل العميل التحقق (نفاذ/سمة/نافذ) - لا يمكن قبول الدفع بعد");
      }
      const { data: profile } = await admin.from("profiles").select("full_name, phone").eq("user_id", cust.user_id).maybeSingle();
      return new Response(JSON.stringify({
        customer: {
          id: cust.id,
          user_id: cust.user_id,
          full_name: profile?.full_name || "عميل",
          phone: profile?.phone || null,
          available_balance: cust.available_balance,
          credit_limit: cust.credit_limit,
        },
        expires_at: ts + TTL_SECONDS,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "pay") {
      const { token, amount } = body;
      const numAmount = Number(amount);
      if (!token || typeof token !== "string") {
        await logAudit(null, null, "invalid_signature", numAmount || null, "كود مفقود");
        throw new Error("token مطلوب");
      }
      if (!numAmount || numAmount <= 0) throw new Error("المبلغ غير صالح");

      const parts = token.split(".");
      if (parts.length !== 4 || parts[0] !== "JIWARv2") {
        await logAudit(null, null, "invalid_signature", numAmount, "صيغة كود غير صحيحة");
        throw new Error("كود غير صالح");
      }
      const [, customerId, tsStr, sig] = parts;
      const ts = parseInt(tsStr, 10);
      if (!ts) throw new Error("كود غير صالح");

      // Resolve merchant id for audit
      const { data: mer } = await admin.from("merchants").select("id").eq("user_id", userId).single();
      const merchantId = mer?.id || null;

      const now = Math.floor(Date.now() / 1000);
      if (now - ts > TTL_SECONDS) {
        await logAudit(customerId, merchantId, "expired", numAmount, "انتهت صلاحية الكود");
        // Notify customer
        const { data: cust } = await admin.from("customers").select("user_id").eq("id", customerId).single();
        if (cust?.user_id) {
          await admin.from("notifications").insert({
            user_id: cust.user_id, title: "انتهت صلاحية الكود",
            message: "انتهت صلاحية كود الدفع - يُرجى توليد كود جديد", type: "warning",
          });
        }
        return new Response(JSON.stringify({ error: "انتهت صلاحية الكود - اطلب من العميل تحديثه" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expectedSig = await hmacSign(`${customerId}.${ts}`, SECRET);
      if (expectedSig !== sig) {
        await logAudit(customerId, merchantId, "invalid_signature", numAmount, "توقيع غير صالح");
        throw new Error("توقيع غير صالح");
      }

      // Instead of charging directly, create a payment request awaiting customer approval
      const { data: cust } = await admin.from("customers").select("user_id").eq("id", customerId).single();
      if (!merchantId) throw new Error("حساب التاجر غير موجود");
      if (!cust?.user_id) throw new Error("العميل غير موجود");

      const { data: reqRow, error: reqErr } = await admin.from("payment_requests").insert({
        customer_id: customerId,
        merchant_id: merchantId,
        customer_user_id: cust.user_id,
        merchant_user_id: userId,
        amount: numAmount,
      }).select("id, expires_at").single();
      if (reqErr) throw new Error(reqErr.message);

      const { data: merProfile } = await admin.from("profiles").select("full_name").eq("user_id", userId).single();
      await admin.from("notifications").insert({
        user_id: cust.user_id,
        title: "طلب دفع جديد",
        message: `يطلب ${merProfile?.full_name || "التاجر"} خصم ${numAmount} ر.س - وافق أو ارفض من التطبيق`,
        type: "payment_request",
      });
      await logAudit(customerId, merchantId, "request_created", numAmount, "بانتظار موافقة العميل", { request_id: reqRow.id });

      return new Response(JSON.stringify({
        pending: true,
        request_id: reqRow.id,
        expires_at: reqRow.expires_at,
        amount: numAmount,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("action غير صالح");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطأ";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
