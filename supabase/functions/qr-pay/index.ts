import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TTL_SECONDS = 60;

type ParsedQrToken = {
  version: "v2" | "v3" | "s1";
  customerId: string;
  customerUserId: string | null;
  accountNumber: string | null;
  timestamp: number;
  signature: string;
  signedPayload: string;
};

function uuidToCompact(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

function compactToUuid(value: string): string {
  if (!/^[0-9a-f]{32}$/i.test(value)) throw new Error("كود غير صالح");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join("-").toLowerCase();
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeQrToken(input: string): string {
  const cleaned = input
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[．。｡]/g, ".")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "");

  let token = cleaned;
  try {
    if (/^https?:\/\//i.test(cleaned)) {
      const url = new URL(cleaned);
      token = url.searchParams.get("t") || url.searchParams.get("token") || decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || cleaned);
    }
  } catch (_) {
    token = cleaned;
  }

  return token.replace(/\s+/g, "");
}

function parseQrToken(token: string): ParsedQrToken {
  const cleaned = normalizeQrToken(token);
  const parts = cleaned.split(".");
  if (/^JIWARs1$/i.test(parts[0])) {
    const [, accountNumber, signature] = parts;
    if (!accountNumber || !/^\d{6,20}$/.test(accountNumber) || !signature) throw new Error("كود غير صالح");
    return {
      version: "s1",
      customerId: "",
      customerUserId: null,
      accountNumber,
      timestamp: 0,
      signature,
      signedPayload: `s1.${accountNumber}`,
    };
  }
  if (/^JIWARv3$/i.test(parts[0])) {
    const [, compactCustomerId, compactCustomerUserId, ts36, signature] = parts;
    const timestamp = parseInt(ts36, 36);
    if (!compactCustomerId || !compactCustomerUserId || !timestamp || !signature) throw new Error("كود غير صالح");
    return {
      version: "v3",
      customerId: compactToUuid(compactCustomerId),
      customerUserId: compactToUuid(compactCustomerUserId),
      accountNumber: null,
      timestamp,
      signature,
      signedPayload: `${compactCustomerId.toLowerCase()}.${compactCustomerUserId.toLowerCase()}.${ts36.toLowerCase()}`,
    };
  }

  if (!/^JIWARv2$/i.test(parts[0])) throw new Error("كود غير صالح");

  if (parts.length === 4) {
    const [, customerId, tsStr, signature] = parts;
    const timestamp = parseInt(tsStr, 10);
    if (!customerId || !timestamp || !signature) throw new Error("كود غير صالح");
    return {
      version: "v2",
      customerId,
      customerUserId: null,
      accountNumber: null,
      timestamp,
      signature,
      signedPayload: `${customerId}.${timestamp}`,
    };
  }

  if (parts.length === 5) {
    const [, customerId, customerUserId, tsStr, signature] = parts;
    const timestamp = parseInt(tsStr, 10);
    if (!customerId || !customerUserId || !timestamp || !signature) throw new Error("كود غير صالح");
    return {
      version: "v2",
      customerId,
      customerUserId,
      accountNumber: null,
      timestamp,
      signature,
      signedPayload: `${customerId}.${customerUserId}.${timestamp}`,
    };
  }

  throw new Error("كود غير صالح");
}

function signaturesMatch(expected: string, actual: string) {
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSignCompact(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64Url(new Uint8Array(sig).slice(0, 20));
}

async function expectedSignature(parsed: ParsedQrToken, secret: string): Promise<string> {
  if (parsed.version === "v3") return hmacSignCompact(parsed.signedPayload, secret);
  if (parsed.version === "s1") return hmacSignCompact(parsed.signedPayload, secret);
  return hmacSign(parsed.signedPayload, secret);
}

async function resolveCustomer(admin: ReturnType<typeof createClient>, parsed: ParsedQrToken) {
  if (parsed.version === "s1" && parsed.accountNumber) {
    const { data: byAcct, error: acctErr } = await admin
      .from("customers")
      .select("id, available_balance, credit_limit, user_id, onboarding_completed, account_number")
      .eq("account_number", parsed.accountNumber)
      .maybeSingle();
    if (acctErr) return { customer: null, error: acctErr.message, relinked: false };
    return { customer: byAcct, error: null, relinked: false };
  }

  const { data: byId, error: byIdError } = await admin
    .from("customers")
    .select("id, available_balance, credit_limit, user_id, onboarding_completed, account_number")
    .eq("id", parsed.customerId)
    .maybeSingle();

  if (byIdError) return { customer: null, error: byIdError.message, relinked: false };
  if (byId) return { customer: byId, error: null, relinked: false };

  if (!parsed.customerUserId) return { customer: null, error: null, relinked: false };

  const { data: byUser, error: byUserError } = await admin
    .from("customers")
    .select("id, available_balance, credit_limit, user_id, onboarding_completed, account_number")
    .eq("user_id", parsed.customerUserId)
    .maybeSingle();

  if (byUserError) return { customer: null, error: byUserError.message, relinked: false };
  return { customer: byUser, error: null, relinked: Boolean(byUser) };
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
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;
    const body = await req.json();
    const action = body.action;

    if (action === "generate") {
      const { data: customer } = await admin.from("customers").select("id, user_id").eq("user_id", userId).maybeSingle();
      if (!customer) {
        return jsonResponse({ error: "ليس لديك حساب عميل" }, 400);
      }
      const ts = Math.floor(Date.now() / 1000);
      const compactCustomerId = uuidToCompact(customer.id);
      const compactUserId = uuidToCompact(customer.user_id);
      const ts36 = ts.toString(36);
      const payload = `${compactCustomerId}.${compactUserId}.${ts36}`;
      const sig = await hmacSignCompact(payload, SECRET);
      const token = `JIWARv3.${compactCustomerId}.${compactUserId}.${ts36}.${sig}`;
      await logAudit(customer.id, null, "generated", null, "تم توليد كود ديناميكي", { ttl: TTL_SECONDS });
      return jsonResponse({ token, ttl: TTL_SECONDS, expires_at: ts + TTL_SECONDS });
    }

    if (action === "generate_static") {
      const { data: customer } = await admin
        .from("customers")
        .select("id, user_id, account_number")
        .eq("user_id", userId)
        .maybeSingle();
      if (!customer) return jsonResponse({ error: "ليس لديك حساب عميل" }, 400);
      if (!customer.account_number) return jsonResponse({ error: "رقم الحساب غير متوفر" }, 400);
      const payload = `s1.${customer.account_number}`;
      const sig = await hmacSignCompact(payload, SECRET);
      const token = `JIWARs1.${customer.account_number}.${sig}`;
      await logAudit(customer.id, null, "generated_static", null, "تم توليد الكود الثابت", { account_number: customer.account_number });
      return jsonResponse({ token, account_number: customer.account_number });
    }

    if (action === "lookup") {
      const { token: rawToken } = body;
      if (!rawToken || typeof rawToken !== "string") throw new Error("token مطلوب");
      // Allow merchant to enter just the account number (digits only) — auto-wrap as static token
      let token = rawToken.trim();
      if (/^\d{6,20}$/.test(token)) {
        if (!SECRET) throw new Error("JIWAR_QR_SECRET missing");
        const sig = await hmacSignCompact(`s1.${token}`, SECRET);
        token = `JIWARs1.${token}.${sig}`;
      }
      let parsed: ParsedQrToken;
      try {
        parsed = parseQrToken(token);
      } catch (_) {
        await logAudit(null, null, "invalid_signature", null, "صيغة كود غير صحيحة (lookup)");
        throw new Error("كود غير صالح");
      }
      const { data: mer } = await admin.from("merchants").select("id").eq("user_id", userId).maybeSingle();
      if (!mer) throw new Error("حساب التاجر غير موجود - سجّل دخول من حساب تاجر");
      const now = Math.floor(Date.now() / 1000);
      if (parsed.version !== "s1" && now - parsed.timestamp > TTL_SECONDS) {
        await logAudit(parsed.customerId, mer.id, "expired", null, "انتهت صلاحية الكود (lookup)");
        throw new Error("انتهت صلاحية الكود - اطلب من العميل تحديثه");
      }
      const expectedSig = await expectedSignature(parsed, SECRET);
      if (!signaturesMatch(expectedSig, parsed.signature)) {
        await logAudit(parsed.customerId, mer.id, "invalid_signature", null, "توقيع غير صالح (lookup)");
        throw new Error("توقيع غير صالح");
      }
      const { customer: cust, error: custErr, relinked } = await resolveCustomer(admin, parsed);
      if (custErr) {
        await logAudit(parsed.customerId, mer.id, "lookup_error", null, custErr);
        throw new Error("تعذر قراءة بيانات العميل");
      }
      if (!cust) {
        await logAudit(parsed.customerId || null, mer.id, "customer_not_found", null, "معرّف العميل في الكود غير موجود");
        throw new Error("العميل غير موجود - قد يكون الكود قديماً أو الحساب محذوفاً");
      }
      if (relinked) {
        await logAudit(cust.id, mer.id, "customer_relinked", null, "تم ربط الكود بحساب العميل عبر user_id", { token_customer_id: parsed.customerId });
      }
      const { data: profile } = await admin.from("profiles").select("full_name, phone").eq("user_id", cust.user_id).maybeSingle();
      const canPay = Boolean(cust.onboarding_completed);
      if (!canPay) {
        await logAudit(cust.id, mer.id, "onboarding_incomplete", null, "تم التعرف على العميل لكن لم يكمل التحقق");
      }
      return jsonResponse({
        token,
        customer: {
          id: cust.id,
          user_id: cust.user_id,
          full_name: profile?.full_name || "عميل",
          phone: profile?.phone || null,
          account_number: (cust as any).account_number || null,
          available_balance: cust.available_balance,
          credit_limit: cust.credit_limit,
          can_pay: canPay,
          verification_reason: canPay ? null : "تم التعرف على العميل، لكنه لم يكمل التحقق (نفاذ/سمة/نافذ) بعد",
        },
        expires_at: parsed.version === "s1" ? null : parsed.timestamp + TTL_SECONDS,
        static: parsed.version === "s1",
      });
    }

    if (action === "pay") {
      const { token, amount } = body;
      const numAmount = Number(amount);
      if (!token || typeof token !== "string") {
        await logAudit(null, null, "invalid_signature", numAmount || null, "كود مفقود");
        throw new Error("token مطلوب");
      }
      if (!numAmount || numAmount <= 0) throw new Error("المبلغ غير صالح");

      let parsed: ParsedQrToken;
      try {
        parsed = parseQrToken(token);
      } catch (_) {
        await logAudit(null, null, "invalid_signature", numAmount, "صيغة كود غير صحيحة");
        throw new Error("كود غير صالح");
      }

      // Resolve merchant id for audit
      const { data: mer } = await admin.from("merchants").select("id").eq("user_id", userId).maybeSingle();
      const merchantId = mer?.id || null;

      const now = Math.floor(Date.now() / 1000);
      if (now - parsed.timestamp > TTL_SECONDS) {
        await logAudit(parsed.customerId, merchantId, "expired", numAmount, "انتهت صلاحية الكود");
        // Notify customer
        const { customer: cust } = await resolveCustomer(admin, parsed);
        if (cust?.user_id) {
          await admin.from("notifications").insert({
            user_id: cust.user_id, title: "انتهت صلاحية الكود",
            message: "انتهت صلاحية كود الدفع - يُرجى توليد كود جديد", type: "warning",
          });
        }
        return jsonResponse({ error: "انتهت صلاحية الكود - اطلب من العميل تحديثه" }, 400);
      }

      const expectedSig = await expectedSignature(parsed, SECRET);
      if (!signaturesMatch(expectedSig, parsed.signature)) {
        await logAudit(parsed.customerId, merchantId, "invalid_signature", numAmount, "توقيع غير صالح");
        throw new Error("توقيع غير صالح");
      }

      // Instead of charging directly, create a payment request awaiting customer approval
      const { customer: cust } = await resolveCustomer(admin, parsed);
      if (!merchantId) throw new Error("حساب التاجر غير موجود - سجّل دخول من حساب تاجر");
      if (!cust?.user_id) throw new Error("العميل غير موجود - قد يكون الكود قديماً أو الحساب محذوفاً");
      if (!cust.onboarding_completed) throw new Error("لم يكمل العميل التحقق (نفاذ/سمة/نافذ)");

      // Idempotency hash bound to token + merchant + amount
      const hashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${token}|${merchantId}|${numAmount}`),
      );
      const qrTokenHash = base64Url(new Uint8Array(hashBytes));

      const { data: reqRow, error: reqErr } = await admin.from("payment_requests").insert({
        customer_id: cust.id,
        merchant_id: merchantId,
        customer_user_id: cust.user_id,
        merchant_user_id: userId,
        amount: numAmount,
        qr_token_hash: qrTokenHash,
      }).select("id, expires_at").single();
      if (reqErr) throw new Error(reqErr.message);

      const { data: merProfile } = await admin.from("profiles").select("full_name").eq("user_id", userId).single();
      await admin.from("notifications").insert({
        user_id: cust.user_id,
        title: "طلب دفع جديد",
        message: `يطلب ${merProfile?.full_name || "التاجر"} خصم ${numAmount} ر.س - وافق أو ارفض من التطبيق`,
        type: "payment_request",
      });
      await logAudit(cust.id, merchantId, "request_created", numAmount, "بانتظار موافقة العميل", { request_id: reqRow.id });

      return jsonResponse({
        pending: true,
        request_id: reqRow.id,
        expires_at: reqRow.expires_at,
        amount: numAmount,
      });
    }

    throw new Error("action غير صالح");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطأ";
    return jsonResponse({ error: msg }, 400);
  }
});
