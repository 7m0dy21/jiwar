import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt, LogOut } from "lucide-react";
import jiwarLogo from "@/assets/jiwar-logo.png";
import QRDisplay from "./QRDisplay";
import DynamicQR from "./DynamicQR";
import OnboardingFlow from "./OnboardingFlow";
import TransactionList from "./TransactionList";
import NotificationBell from "./NotificationBell";
import PaymentDialog from "./PaymentDialog";
import NearbyMerchants from "./NearbyMerchants";
import QRAuditLog from "./QRAuditLog";
import PaymentApprovals from "./PaymentApprovals";
import NotificationSettings from "./NotificationSettings";

const CustomerDashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [txCount, setTxCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = async () => {
    if (!user) return;
    const [p, c] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("customers").select("*").eq("user_id", user.id).single(),
    ]);
    setProfile(p.data);
    setCustomer(c.data);
    if (c.data) {
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", c.data.id);
      setTxCount(count || 0);
    }
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    reload();

    if (!user) return;

    // Realtime subscription for balance updates
    const channel = supabase
      .channel("customer-transactions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => {
        reload(); // Reload on new transaction
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const available = customer?.available_balance ?? 0;
  const limit = customer?.credit_limit ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <PaymentApprovals />
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={jiwarLogo} alt="جوار" className="w-10 h-10" />
          <div>
            <p className="font-cairo font-bold text-foreground">محفظتي</p>
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

        {/* Onboarding gate */}
        {customer && !customer.onboarding_completed && (
          <div className="mb-6">
            <OnboardingFlow
              customerId={customer.id}
              status={{
                nafath: !!customer.nafath_verified,
                simah: !!customer.simah_score,
                nafith: !!customer.nafith_signed,
              }}
              onComplete={reload}
            />
          </div>
        )}

        {/* Payment button */}
        {customer && (
          <div className="mb-8">
            <PaymentDialog customerId={customer.id} owedAmount={limit - available} onSuccess={reload} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-2">
            <DynamicQR customerName={profile?.full_name || "عميل"} />
            {customer?.qr_code && (
              <QRDisplay qrCode={customer.qr_code} name={profile?.full_name || "عميل"} />
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground font-ibm">المستحقات</span>
            </div>
            <p className="text-xl font-cairo font-bold text-foreground">{limit - available} ر.س</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground font-ibm">العمليات</span>
            </div>
            <p className="text-xl font-cairo font-bold text-foreground">{txCount} عملية</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-card mb-8">
          <h2 className="font-cairo font-bold text-foreground text-lg mb-4">سجل العمليات</h2>
          {user && <TransactionList userId={user.id} role="customer" refreshKey={refreshKey} />}
        </div>

        {customer && (
          <div className="mb-8">
            <QRAuditLog scope="customer" entityId={customer.id} />
          </div>
        )}

        <NearbyMerchants />

        <div className="mt-8">
          <NotificationSettings />
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboard;
