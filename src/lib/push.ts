import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { firebaseConfig, VAPID_PUBLIC_KEY, isFirebaseConfigured } from "@/config/firebase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function initMessaging() {
  if (!isFirebaseConfigured()) return null;
  if (!(await isSupported())) return null;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
    onMessage(messagingInstance, (payload) => {
      toast(payload.notification?.title || "إشعار", {
        description: payload.notification?.body || "",
      });
    });
  }
  return messagingInstance;
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
}

export async function enablePush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isFirebaseConfigured()) {
    return { ok: false, reason: "لم يتم إعداد Firebase بعد. أضف مفاتيح Web Push في الإعدادات." };
  }
  if (!("Notification" in window)) return { ok: false, reason: "المتصفح لا يدعم الإشعارات" };

  const perm = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "لم يتم منح إذن الإشعارات" };

  const swReg = await ensureServiceWorker();
  const messaging = await initMessaging();
  if (!messaging || !swReg) return { ok: false, reason: "تعذّر تهيئة خدمة الرسائل" };

  const token = await getToken(messaging, {
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: swReg,
  });
  if (!token) return { ok: false, reason: "تعذّر توليد رمز الجهاز" };

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("fcm_tokens").eq("user_id", userId).maybeSingle();

  const tokens = new Set<string>(existing?.fcm_tokens || []);
  tokens.add(token);

  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    push_enabled: true,
    fcm_tokens: Array.from(tokens),
    platform: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios-web" : /Android/i.test(navigator.userAgent) ? "android-web" : "web",
  }, { onConflict: "user_id" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function disablePush(userId: string) {
  await supabase.from("notification_preferences")
    .upsert({ user_id: userId, push_enabled: false, fcm_tokens: [] }, { onConflict: "user_id" });
}

export async function getPreferences(userId: string) {
  const { data } = await supabase
    .from("notification_preferences")
    .select("in_app_enabled, push_enabled")
    .eq("user_id", userId).maybeSingle();
  return data || { in_app_enabled: true, push_enabled: false };
}

export async function setInAppEnabled(userId: string, enabled: boolean) {
  await supabase.from("notification_preferences")
    .upsert({ user_id: userId, in_app_enabled: enabled }, { onConflict: "user_id" });
}
