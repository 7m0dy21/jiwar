import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bell, Smartphone, Send, Trash2, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { enablePush, disablePush, getCurrentDeviceToken } from "@/lib/push";
import { isFirebaseConfigured } from "@/config/firebase";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type TypePrefs = Record<string, { in_app: boolean; push: boolean }>;

const TYPE_LABELS: Record<string, { title: string; desc: string; role?: "customer" | "merchant" | "both" }> = {
  transaction: { title: "عمليات الشراء والمسح", desc: "عند مسح QR وتأكيد المبلغ من التاجر / خصم من رصيد العميل", role: "both" },
  payment:     { title: "تحصيل السداد", desc: "عند تسديد العميل أو تحصيل المبلغ", role: "customer" },
  reminder:    { title: "تذكيرات موعد السداد", desc: "قبل موعد السداد الشهري للعميل", role: "customer" },
  settlement:  { title: "التسوية الشهرية", desc: "تسوية التاجر وتأكيد نجاح دفعات العميل نهاية الشهر", role: "both" },
  warning:     { title: "تنبيهات مهمة", desc: "رفض الدفع، تجاوز الحد، انتهاء صلاحية QR", role: "both" },
  info:        { title: "أخبار وإعلانات", desc: "تحديثات المنتج والعروض" },
  test:        { title: "الإشعارات التجريبية", desc: "الإشعارات المُرسلة من أداة الاختبار" },
};

interface Device { id: string; token: string; label: string | null; platform: string | null; last_seen_at: string; }
interface NotifRow { id: string; title: string; message: string; type: string; channel: string; delivery_status: string; is_read: boolean; created_at: string; }

const statusMeta = (s: string) => {
  switch (s) {
    case "delivered": return { icon: CheckCircle2, cls: "text-green-600", label: "تم التسليم" };
    case "failed":    return { icon: XCircle,      cls: "text-destructive", label: "فشل" };
    case "queued":    return { icon: Clock,        cls: "text-amber-600", label: "في الانتظار" };
    case "skipped":   return { icon: XCircle,      cls: "text-muted-foreground", label: "متجاهل" };
    default:          return { icon: CheckCircle2, cls: "text-muted-foreground", label: s };
  }
};

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [typePrefs, setTypePrefs] = useState<TypePrefs>({});
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [sending, setSending] = useState(false);
  const [testTarget, setTestTarget] = useState<string>("current");
  const configured = isFirebaseConfigured();

  const loadAll = async () => {
    if (!user) return;
    const [{ data: pref }, { data: devs }, { data: ns }, tok] = await Promise.all([
      supabase.from("notification_preferences").select("in_app_enabled, push_enabled, type_preferences").eq("user_id", user.id).maybeSingle(),
      supabase.from("device_tokens").select("*").eq("user_id", user.id).order("last_seen_at", { ascending: false }),
      supabase.from("notifications").select("id,title,message,type,channel,delivery_status,is_read,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      getCurrentDeviceToken(),
    ]);
    setInAppEnabled(pref?.in_app_enabled ?? true);
    setPushEnabled(pref?.push_enabled ?? false);
    setTypePrefs((pref?.type_preferences as TypePrefs) || {});
    setDevices((devs || []) as Device[]);
    setNotifs((ns || []) as NotifRow[]);
    setCurrentToken(tok);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    if (!user) return;
    const ch = supabase.channel("notif-settings-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const savePrefs = async (patch: Partial<{ in_app_enabled: boolean; push_enabled: boolean; type_preferences: TypePrefs }>) => {
    if (!user) return;
    const { error } = await supabase.from("notification_preferences")
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
    if (error) toast.error(error.message); else toast.success("تم الحفظ");
  };

  const togglePush = async (v: boolean) => {
    if (!user) return;
    if (v) {
      const res = await enablePush(user.id);
      if (res.ok) { setPushEnabled(true); toast.success("تم تفعيل الإشعارات على هذا الجهاز"); loadAll(); }
      else toast.error(res.reason || "فشل التفعيل");
    } else {
      await disablePush(user.id); setPushEnabled(false); toast.success("تم إيقاف الإشعارات");
      loadAll();
    }
  };

  const toggleType = (key: string, channel: "in_app" | "push", v: boolean) => {
    const current = typePrefs[key] || { in_app: true, push: true };
    const next: TypePrefs = { ...typePrefs, [key]: { ...current, [channel]: v } };
    setTypePrefs(next);
    savePrefs({ type_preferences: next });
  };

  const removeDevice = async (d: Device) => {
    if (!user) return;
    await supabase.from("device_tokens").delete().eq("id", d.id);
    const { data: pref } = await supabase.from("notification_preferences").select("fcm_tokens").eq("user_id", user.id).maybeSingle();
    const remaining = (pref?.fcm_tokens || []).filter((t: string) => t !== d.token);
    await supabase.from("notification_preferences").update({ fcm_tokens: remaining }).eq("user_id", user.id);
    toast.success("تم حذف الجهاز");
    loadAll();
  };

  const sendTest = async () => {
    if (!user) return;
    setSending(true);
    try {
      const targetToken =
        testTarget === "current" ? currentToken :
        testTarget === "all" ? null :
        testTarget; // specific token id? we pass token directly
      // If a specific device is chosen from the list, testTarget is that device token
      const { data: nid, error } = await supabase.rpc("send_test_notification", { p_token: targetToken });
      if (error) throw error;
      // Directly invoke push edge so we can pass target_token override
      if (targetToken) {
        await supabase.functions.invoke("send-push", {
          body: {
            user_id: user.id,
            title: "إشعار تجريبي",
            message: "هذا إشعار تجريبي من جوار — إذا وصلك فالإعداد يعمل ✅",
            type: "test",
            notification_id: nid,
            target_token: targetToken,
          },
        });
      }
      toast.success("تم إرسال الإشعار التجريبي");
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "فشل الإرسال");
    } finally { setSending(false); }
  };

  const grouped = useMemo(() => Object.entries(TYPE_LABELS), []);

  if (!user) { navigate("/auth"); return null; }
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-cairo font-bold text-2xl text-foreground">إعدادات الإشعارات</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowRight className="w-4 h-4 ml-1" /> رجوع
          </Button>
        </div>

        {/* Master toggles */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-cairo font-bold text-foreground text-lg">التحكم العام</h2>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div>
              <Label className="font-cairo font-bold">إشعارات داخل التطبيق</Label>
              <p className="text-xs text-muted-foreground font-ibm mt-1">تظهر في جرس الإشعارات وسجل الإشعارات</p>
            </div>
            <Switch checked={inAppEnabled} onCheckedChange={(v) => { setInAppEnabled(v); savePrefs({ in_app_enabled: v }); }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <Label className="font-cairo font-bold">إشعارات فورية (Push)</Label>
                <p className="text-xs text-muted-foreground font-ibm mt-1">تصل مباشرة إلى جهازك حتى عند إغلاق التطبيق</p>
                {!configured && <p className="text-xs text-amber-600 mt-2">⚠️ Firebase غير مُعد بالكامل بعد.</p>}
              </div>
            </div>
            <Switch checked={pushEnabled} onCheckedChange={togglePush} disabled={!configured} />
          </div>
        </section>

        {/* Per-type preferences */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <h2 className="font-cairo font-bold text-foreground text-lg mb-1">أنواع الإشعارات</h2>
          <p className="text-xs text-muted-foreground mb-4">فعّل أو أوقف كل نوع لكل قناة على حدة</p>
          <div className="space-y-3">
            {grouped.map(([key, meta]) => {
              const p = typePrefs[key] || { in_app: true, push: true };
              return (
                <div key={key} className="p-3 rounded-lg border border-border/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-cairo font-bold text-sm text-foreground">{meta.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
                    </div>
                    {meta.role && meta.role !== "both" && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {meta.role === "customer" ? "للعميل" : "للتاجر"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-6 mt-3">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={p.in_app} onCheckedChange={(v) => toggleType(key, "in_app", v)} />
                      داخل التطبيق
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={p.push} onCheckedChange={(v) => toggleType(key, "push", v)} disabled={!pushEnabled} />
                      إشعار فوري
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Devices */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <h2 className="font-cairo font-bold text-foreground text-lg mb-4">الأجهزة المرتبطة</h2>
          {devices.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد أجهزة — فعّل الإشعارات الفورية أعلاه لتسجيل هذا الجهاز.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                  <div className="min-w-0">
                    <p className="font-cairo text-sm text-foreground truncate">{d.label || "جهاز"}</p>
                    <p className="text-[11px] text-muted-foreground font-ibm">
                      {d.platform} — آخر ظهور {format(new Date(d.last_seen_at), "dd MMM HH:mm", { locale: ar })}
                      {currentToken === d.token && <span className="text-primary mr-2">• هذا الجهاز</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeDevice(d)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Test tool */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <h2 className="font-cairo font-bold text-foreground text-lg">اختبار وصول الإشعار</h2>
          <p className="text-xs text-muted-foreground">أرسل إشعارًا تجريبيًا وتأكد من ظهوره في السجل أدناه بحالة "تم التسليم".</p>
          <div className="space-y-2">
            <Label className="text-xs">الجهاز المستهدف</Label>
            <select
              value={testTarget}
              onChange={(e) => setTestTarget(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="current">هذا الجهاز فقط</option>
              <option value="all">جميع أجهزتي (يحترم التفضيلات)</option>
              {devices.map((d) => (
                <option key={d.id} value={d.token}>جهاز محدد — {d.label || d.platform}</option>
              ))}
            </select>
          </div>
          <Button onClick={sendTest} disabled={sending} className="w-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 ml-2" /> إرسال إشعار تجريبي</>}
          </Button>
        </section>

        {/* Notifications log */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <h2 className="font-cairo font-bold text-foreground text-lg mb-4">سجل الإشعارات (آخر 50)</h2>
          {notifs.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا يوجد سجل حتى الآن.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {notifs.map((n) => {
                const s = statusMeta(n.delivery_status);
                const SIco = s.icon;
                return (
                  <div key={n.id} className="py-3 flex items-start gap-3">
                    <SIco className={`w-4 h-4 mt-1 ${s.cls}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-cairo font-bold text-sm text-foreground">{n.title}</p>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[n.type]?.title || n.type}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{n.channel === "push" ? "فوري" : "داخلي"}</Badge>
                        <span className={`text-[10px] font-ibm ${s.cls}`}>{s.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-ibm mt-1">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-ibm mt-1">
                        {format(new Date(n.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
