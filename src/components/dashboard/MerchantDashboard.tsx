import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, DollarSign, Users, LogOut, Landmark, Save } from "lucide-react";
import jiwarLogo from "@/assets/jiwar-logo.png";
import QRScanner from "./QRScanner";
import TransactionList from "./TransactionList";
import NotificationBell from "./NotificationBell";
import MerchantSettlementsPanel from "./MerchantSettlementsPanel";
import MerchantMonthlyReport from "./MerchantMonthlyReport";
import QRAuditLog from "./QRAuditLog";
import NotificationSettings from "./NotificationSettings";
import { toast } from "sonner";

const MerchantDashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [transfers, setTransfers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [p, m] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("merchants").select("*").eq("user_id", user.id).single(),
      ]);
      setProfile(p.data);
      setMerchant(m.data);
      if (m.data) {
        setIban(m.data.iban || "");
        setBankName(m.data.bank_name || "");

        // Load today's sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: txs } = await supabase
          .from("transactions")
          .select("amount")
          .eq("merchant_id", m.data.id)
          .gte("created_at", today.toISOString());
        const total = (txs || []).reduce((sum, t) => sum + Number(t.amount), 0);
        setTodaySales(total);

        // Load transfers
        const { data: trData } = await supabase
          .from("merchant_transfers")
          .select("*")
          .eq("merchant_id", m.data.id)
          .order("created_at", { ascending: false })
          .limit(10);
        setTransfers(trData || []);
      }
    };
    load();
  }, [user, refreshKey]);

  const handleSaveBankInfo = async () => {
    if (!merchant) return;
    setSavingBank(true);
    const { error } = await supabase
      .from("merchants")
      .update({ iban: iban.trim(), bank_name: bankName.trim() })
      .eq("id", merchant.id);
    setSavingBank(false);
    if (error) { toast.error("حدث خطأ في الحفظ"); return; }
    toast.success("تم حفظ البيانات البنكية");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={jiwarLogo} alt="جوار" className="w-10 h-10" />
          <div>
            <p className="font-cairo font-bold text-foreground">لوحة التاجر</p>
            <p className="text-sm text-muted-foreground font-ibm">{profile?.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4 ml-2" />
            خروج
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-cairo font-bold text-foreground">
            مرحباً، {merchant?.store_name || "التاجر"} 👋
          </h1>
          {merchant && (
            <QRScanner merchantId={merchant.id} onSuccess={() => setRefreshKey((k) => k + 1)} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { icon: DollarSign, label: "المبيعات اليوم", value: `${todaySales} ر.س`, color: "text-primary" },
            { icon: Users, label: "العملاء النشطون", value: "—", color: "text-jiwar-blue" },
            { icon: Store, label: "حالة المتجر", value: merchant?.is_active ? "مفعّل" : "قيد المراجعة", color: "text-jiwar-gold" },
          ].map((stat, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <span className="text-sm text-muted-foreground font-ibm">{stat.label}</span>
              </div>
              <p className="text-2xl font-cairo font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Bank Info Section */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-card mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-primary" />
            <h2 className="font-cairo font-bold text-foreground text-lg">البيانات البنكية</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-cairo">اسم البنك</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="مثال: بنك الراجحي" className="mt-1" />
            </div>
            <div>
              <Label className="font-cairo">رقم الآيبان (IBAN)</Label>
              <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA0000000000000000000000" dir="ltr" className="mt-1" />
            </div>
          </div>
          <Button onClick={handleSaveBankInfo} disabled={savingBank} className="mt-4 bg-gradient-primary text-primary-foreground font-cairo gap-1">
            <Save className="w-4 h-4" />
            {savingBank ? "جارٍ الحفظ..." : "حفظ البيانات البنكية"}
          </Button>
        </div>

        {/* Transfers Section */}
        {transfers.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-card mb-8">
            <h2 className="font-cairo font-bold text-foreground text-lg mb-4">التحويلات المالية</h2>
            <div className="space-y-3">
              {transfers.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div>
                    <p className="font-cairo font-bold text-foreground">{t.amount} ر.س</p>
                    <p className="text-xs text-muted-foreground font-ibm">{new Date(t.created_at).toLocaleDateString("ar-SA")}</p>
                  </div>
                  <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "secondary" : "outline"} className="font-cairo">
                    {t.status === "completed" ? "مكتمل" : t.status === "pending" ? "قيد المراجعة" : t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {merchant && (
          <div className="mb-8">
            <MerchantSettlementsPanel merchantId={merchant.id} />
          </div>
        )}

        {merchant && user && (
          <div className="mb-8">
            <MerchantMonthlyReport merchantId={merchant.id} merchantUserId={user.id} />
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 shadow-card mb-8">
          <h2 className="font-cairo font-bold text-foreground text-lg mb-4">آخر العمليات</h2>
          {user && <TransactionList userId={user.id} role="merchant" refreshKey={refreshKey} />}
        </div>

        {merchant && <QRAuditLog scope="merchant" entityId={merchant.id} />}
      </main>
    </div>
  );
};

export default MerchantDashboard;
