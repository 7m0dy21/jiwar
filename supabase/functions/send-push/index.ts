import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Google OAuth2: get access token from service account (for FCM HTTP v1) ----
function b64url(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : (input instanceof Uint8Array ? input : new Uint8Array(input));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth token failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SA_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!SA_JSON) {
      return new Response(JSON.stringify({ skipped: true, reason: "FIREBASE_SERVICE_ACCOUNT_JSON missing" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- AuthN/AuthZ: require either service-role (internal trigger) or a valid user JWT ----
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const isServiceRole = token === SERVICE_KEY;

    let callerUserId: string | null = null;
    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = claimsData.claims.sub as string;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const { user_id, title, message, type, notification_id } = body;
    let { target_token } = body;
    if (!user_id || !title) throw new Error("user_id and title required");

    // Non-service callers can only push to themselves
    if (!isServiceRole && user_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-service callers may only target device tokens they own
    if (!isServiceRole && target_token) {
      const { data: owned } = await admin
        .from("device_tokens")
        .select("token")
        .eq("user_id", callerUserId)
        .eq("token", target_token)
        .maybeSingle();
      if (!owned) {
        return new Response(JSON.stringify({ error: "Forbidden target_token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const { data: pref } = await admin
      .from("notification_preferences")
      .select("push_enabled, fcm_tokens, type_preferences")
      .eq("user_id", user_id).maybeSingle();

    // Per-type preference check
    const typeKey = String(type || "info");
    const typePref = (pref?.type_preferences as Record<string, { in_app?: boolean; push?: boolean }> | null)?.[typeKey];
    const pushAllowedForType = typePref?.push ?? true;

    // Test notifications with explicit target_token bypass preference gating
    const isTargeted = !!target_token;
    const tokensToSend: string[] = isTargeted
      ? [target_token]
      : (pref?.push_enabled && pushAllowedForType ? (pref?.fcm_tokens || []) : []);

    if (!tokensToSend.length) {
      if (notification_id) {
        await admin.from("notifications").update({
          delivery_status: "skipped",
        }).eq("id", notification_id);
      }
      return new Response(JSON.stringify({ skipped: true, reason: "push disabled, no tokens, or type muted" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccount = JSON.parse(SA_JSON);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const results: any[] = [];
    const invalidTokens: string[] = [];

    for (const token of tokensToSend) {
      const payload = {
        message: {
          token,
          notification: { title, body: message || "" },
          data: {
            type: String(type || ""),
            notification_id: String(notification_id || ""),
            click_action: "/",
          },
        },
      };
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const rj = await r.json().catch(() => ({}));
      results.push({ token: token.slice(0, 12) + "…", ok: r.ok, status: r.status });
      const err = rj?.error?.details?.[0]?.errorCode || rj?.error?.status;
      if (!r.ok && (err === "UNREGISTERED" || err === "INVALID_ARGUMENT" || r.status === 404)) {
        invalidTokens.push(token);
      }
    }

    if (invalidTokens.length && !isTargeted) {
      const remaining = (pref?.fcm_tokens as string[] || []).filter((t) => !invalidTokens.includes(t));
      await admin.from("notification_preferences").update({ fcm_tokens: remaining }).eq("user_id", user_id);
      await admin.from("device_tokens").delete().in("token", invalidTokens);
    }

    const anyOk = results.some((r) => r.ok);
    if (notification_id) {
      await admin.from("notifications").update({
        delivery_status: anyOk ? "delivered" : "failed",
        metadata: { push_results: results },
      }).eq("id", notification_id);
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error", err);
    const msg = err instanceof Error ? err.message : "error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
