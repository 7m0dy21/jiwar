import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { enablePush, disablePush, getPreferences, setInAppEnabled } from "@/lib/push";
import { toast } from "sonner";
import { isFirebaseConfigured } from "@/config/firebase";

const NotificationSettings = () => {
  const { user } = useAuth();
  const [inApp, setInApp] = useState(true);
  const [push, setPush] = useState(false);
  const [loading, setLoading] = useState(false);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!user) return;
    getPreferences(user.id).then((p) => {
      setInApp(!!p.in_app_enabled);
      setPush(!!p.push_enabled);
    });
  }, [user]);

  const togglePush = async (v: boolean) => {
    if (!user) return;
    setLoading(true);
    if (v) {
      const res = await enablePush(user.id);
      if (res.ok) { setPush(true); toast.success("تم تفعيل الإشعارات على هذا الجهاز"); }
      else { setPush(false); toast.error(res.reason || "فشل التفعيل"); }
    } else {
      await disablePush(user.id);
      setPush(false); toast.success("تم إيقاف الإشعارات");
    }
    setLoading(false);
  };

  const toggleInApp = async (v: boolean) => {
    if (!user) return;
    setInApp(v);
    await setInAppEnabled(user.id, v);
    toast.success(v ? "تم تفعيل الإشعارات داخل التطبيق" : "تم إيقاف الإشعارات داخل التطبيق");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="font-cairo font-bold text-foreground text-lg">إعدادات الإشعارات</h2>
      </div>

      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <Label className="font-cairo font-bold">إشعارات داخل التطبيق</Label>
            <p className="text-xs text-muted-foreground font-ibm mt-1">تظهر في جرس الإشعارات داخل جوار</p>
          </div>
        </div>
        <Switch checked={inApp} onCheckedChange={toggleInApp} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <Label className="font-cairo font-bold">إشعارات فورية (Push)</Label>
            <p className="text-xs text-muted-foreground font-ibm mt-1">
              تُرسل مباشرة إلى جهازك حتى عند إغلاق التطبيق
            </p>
            {!configured && (
              <p className="text-xs text-amber-600 font-ibm mt-2">
                ⚠️ لم يتم إعداد مفاتيح Firebase Web Push بعد — أضفها في متغيرات البيئة لتفعيل الإشعارات.
              </p>
            )}
          </div>
        </div>
        <Switch checked={push} onCheckedChange={togglePush} disabled={loading || !configured} />
      </div>

      {push && (
        <p className="text-xs text-muted-foreground font-ibm flex items-center gap-1">
          <BellOff className="w-3 h-3" />
          يمكنك إيقاف الإشعارات في أي وقت من هذه الصفحة أو من إعدادات المتصفح.
        </p>
      )}
    </div>
  );
};

export default NotificationSettings;
