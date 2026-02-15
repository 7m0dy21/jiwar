import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, DollarSign, Users, LogOut } from "lucide-react";
import jiwarLogo from "@/assets/jiwar-logo.png";
import QRScanner from "./QRScanner";
import TransactionList from "./TransactionList";

const MerchantDashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [todaySales, setTodaySales] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [p, m] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("merchants").select("*").eq("user_id", user.id).single(),
      ]);
      setProfile(p.data);
      setMerchant(m.data);

      // Calculate today's sales
      if (m.data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: txs } = await supabase
          .from("transactions")
          .select("amount")
          .eq("merchant_id", m.data.id)
          .gte("created_at", today.toISOString());
        const total = (txs || []).reduce((sum, t) => sum + Number(t.amount), 0);
        setTodaySales(total);
      }
    };
    load();
  }, [user, refreshKey]);

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
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="w-4 h-4 ml-2" />
          خروج
        </Button>
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

        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <h2 className="font-cairo font-bold text-foreground text-lg mb-4">آخر العمليات</h2>
          {user && <TransactionList userId={user.id} role="merchant" refreshKey={refreshKey} />}
        </div>
      </main>
    </div>
  );
};

export default MerchantDashboard;
