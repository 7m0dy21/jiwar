import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, DollarSign, Users, LogOut } from "lucide-react";
import jiwarLogo from "@/assets/jiwar-logo.png";

const MerchantDashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [p, m] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("merchants").select("*").eq("user_id", user.id).single(),
      ]);
      setProfile(p.data);
      setMerchant(m.data);
    };
    load();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        <h1 className="text-2xl font-cairo font-bold text-foreground mb-6">
          مرحباً، {merchant?.store_name || "التاجر"} 👋
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { icon: DollarSign, label: "المبيعات اليوم", value: "٠ ر.س", color: "text-primary" },
            { icon: Users, label: "العملاء النشطون", value: "٠", color: "text-jiwar-blue" },
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

        <div className="bg-card border border-border rounded-2xl p-8 shadow-card text-center">
          <p className="text-muted-foreground font-ibm">لم تتم أي عمليات بعد. ابدأ باستقبال العملاء!</p>
        </div>
      </main>
    </div>
  );
};

export default MerchantDashboard;
