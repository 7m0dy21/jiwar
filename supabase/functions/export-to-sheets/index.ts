import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Google Auth: get access token from service account
async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${encode(header)}.${encode(claim)}`;

  // Import the private key - handle various formats
  let pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "")
    .trim();
  
  // Pad base64 if needed
  while (pemContents.length % 4 !== 0) {
    pemContents += "=";
  }
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to get Google access token: " + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

async function writeToSheet(accessToken: string, spreadsheetId: string, sheetName: string, values: any[][]) {
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  // Clear existing data first
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:Z:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    }
  );

  // Write new data
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error: ${err}`);
  }
}

async function ensureSheet(accessToken: string, spreadsheetId: string, title: string) {
  // Get existing sheets
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const exists = meta.sheets?.some((s: any) => s.properties.title === title);

  if (!exists) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Always require a valid Supabase admin session — no anonymous calls,
    // no implicit "trigger" bypass. Automated exports must go through the
    // service role explicitly.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;
    if (!isServiceRoleCall) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "غير مصرح" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminCheck = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await adminCheck
        .from("user_roles")
        .select("role")
        .eq("user_id", claimsData.claims.sub)
        .eq("role", "admin");
      if (!roleData || roleData.length === 0) {
        return new Response(JSON.stringify({ error: "يجب أن تكون مسؤولاً" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    const spreadsheetId = Deno.env.get("GOOGLE_SPREADSHEET_ID");

    if (!clientEmail || !privateKey || !spreadsheetId) {
      throw new Error("Missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_SPREADSHEET_ID");
    }

    // Reconstruct service account object from individual secrets
    const serviceAccount = {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    };
    const accessToken = await getGoogleAccessToken(serviceAccount);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Export Customers
    const { data: customers } = await supabase
      .from("customers")
      .select("id, user_id, credit_limit, available_balance, is_verified, created_at")
      .order("created_at", { ascending: false });

    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone");
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    const customerRows = [
      ["الاسم", "الهاتف", "حد الائتمان", "الرصيد المتاح", "موثق", "تاريخ التسجيل"],
      ...(customers || []).map((c) => {
        const p = profileMap.get(c.user_id);
        return [
          p?.full_name || "",
          p?.phone || "",
          c.credit_limit,
          c.available_balance,
          c.is_verified ? "نعم" : "لا",
          new Date(c.created_at).toLocaleDateString("ar-SA"),
        ];
      }),
    ];

    await ensureSheet(accessToken, spreadsheetId, "العملاء");
    await writeToSheet(accessToken, spreadsheetId, "العملاء", customerRows);

    // Export Merchants
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id, user_id, store_name, store_address, is_active, created_at")
      .order("created_at", { ascending: false });

    const merchantRows = [
      ["اسم المتجر", "العنوان", "صاحب المتجر", "الهاتف", "نشط", "تاريخ التسجيل"],
      ...(merchants || []).map((m) => {
        const p = profileMap.get(m.user_id);
        return [
          m.store_name,
          m.store_address || "",
          p?.full_name || "",
          p?.phone || "",
          m.is_active ? "نعم" : "لا",
          new Date(m.created_at).toLocaleDateString("ar-SA"),
        ];
      }),
    ];

    await ensureSheet(accessToken, spreadsheetId, "التجار");
    await writeToSheet(accessToken, spreadsheetId, "التجار", merchantRows);

    // Export Transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, customer_id, merchant_id, amount, status, description, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    const { data: allCustomers } = await supabase.from("customers").select("id, user_id");
    const { data: allMerchants } = await supabase.from("merchants").select("id, store_name");
    const custMap = new Map(allCustomers?.map((c) => [c.id, profileMap.get(c.user_id)?.full_name || ""]) || []);
    const merchMap = new Map(allMerchants?.map((m) => [m.id, m.store_name]) || []);

    const txRows = [
      ["العميل", "التاجر", "المبلغ", "الحالة", "الوصف", "التاريخ"],
      ...(transactions || []).map((t) => [
        custMap.get(t.customer_id) || "",
        merchMap.get(t.merchant_id) || "",
        t.amount,
        t.status,
        t.description || "",
        new Date(t.created_at).toLocaleDateString("ar-SA"),
      ]),
    ];

    await ensureSheet(accessToken, spreadsheetId, "المعاملات");
    await writeToSheet(accessToken, spreadsheetId, "المعاملات", txRows);

    const exportTime = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

    return new Response(
      JSON.stringify({ success: true, message: `تم التصدير بنجاح في ${exportTime}`, sheets: ["العملاء", "التجار", "المعاملات"] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
