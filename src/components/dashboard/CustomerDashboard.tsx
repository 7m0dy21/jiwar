import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wallet, QrCode, Receipt, LogOut } from "lucide-react";
import jiwarLogo from "@/assets/jiwar-logo.png";

const CustomerDashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [p, c] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("customers").select("*").eq("user_id", user.id).single(),
      ]);
      setProfile(p.data);
      setCustomer(c.data);
    };
    load();
  }, [user]);

  const available = customer?.available_balance ?? 0;
  const limit = customer?.credit_limit ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={jiwarLogo} alt="جوار" className="w-10 h-10" />
          <div>
            <p className="font-cairo font-bold text-foreground">محفظتي</p>
            <p className="text-sm text-muted-foreground font-ibm">{profile?.full_name}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="w-4 h-4 ml-2" />
          خروج
        </Button>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Balance card */}
        <div className="bg-gradient-primary rounded-2xl p-8 text-primary-foreground mb-8 shadow-card">
          <p className="font-ibm text-sm opacity-80 mb-1">الرصيد المتاح</p>
          <p className="text-4xl font-cairo font-bold mb-2">{available} <span className="text-lg">ر.س</span></p>
          <p className="text-sm opacity-70 font-ibm">من أصل {limit} ر.س</p>
          <div className="w-full bg-primary-foreground/20 rounded-full h-2 mt-4">
            <div
              className="bg-primary-foreground h-2 rounded-full transition-all"
              style={{ width: `${limit > 0 ? (available / limit) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { icon: QrCode, label: "كود الدفع", value: "عرض الكود" },
            { icon: Wallet, label: "المستحقات", value: `${limit - available} ر.س` },
            { icon: Receipt, label: "العمليات", value: "٠ عملية" },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground font-ibm">{item.label}</span>
              </div>
              <p className="text-xl font-cairo font-bold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-card text-center">
          <p className="text-muted-foreground font-ibm">لا توجد عمليات سابقة حتى الآن</p>
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboard;
