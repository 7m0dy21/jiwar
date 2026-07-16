import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Calendar, CheckCircle2, Clock, DollarSign, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props { merchantId: string; }

const MerchantSettlementsPanel = ({ merchantId }: Props) => {
  const [todayCount, setTodayCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthDeferred, setMonthDeferred] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!merchantId) return;
    const load = async () => {
      setLoading(true);
      const startToday = new Date(); startToday.setHours(0,0,0,0);
      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);

      const [today, month, tr, mer, recent] = await Promise.all([
        supabase.from("transactions").select("amount").eq("merchant_id", merchantId).eq("status","completed").gte("created_at", startToday.toISOString()),
        supabase.from("transactions").select("amount").eq("merchant_id", merchantId).eq("status","completed").gte("created_at", startMonth.toISOString()),
        supabase.from("merchant_transfers").select("*").eq("merchant_id", merchantId).gte("created_at", startMonth.toISOString()).order("created_at", { ascending: false }),
        supabase.from("merchants").select("pending_balance").eq("id", merchantId).maybeSingle(),
        supabase.from("transactions").select("id, amount, created_at, settled_at, settlement_transfer_id").eq("merchant_id", merchantId).eq("status","completed").order("created_at", { ascending: false }).limit(8),
      ]);
      setTodayCount((today.data || []).length);
      setTodayTotal((today.data || []).reduce((s, r: any) => s + Number(r.amount), 0));
      setMonthDeferred((month.data || []).reduce((s, r: any) => s + Number(r.amount), 0));
      setTransfers(tr.data || []);
      setPendingBalance(Number((mer.data as any)?.pending_balance || 0));
      setRecentTx(recent.data || []);
      setLoading(false);
    };
    load();

    // Realtime live pending balance
    const ch = supabase
      .channel(`merchant-live-${merchantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "merchants", filter: `id=eq.${merchantId}` },
        (payload: any) => setPendingBalance(Number(payload.new.pending_balance || 0)))
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `merchant_id=eq.${merchantId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId]);

  const settled = transfers.filter((t) => t.status === "completed").reduce((s, t) => s + Number(t.amount), 0);
  const pending = transfers.filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const remaining = Math.max(0, monthDeferred - settled - pending);

  const stats = [
    { icon: Wallet, label: "الرصيد المعلّق الفوري", value: `${pendingBalance.toFixed(2)} ر.س`, color: "text-jiwar-green" },
    { icon: DollarSign, label: "عمليات اليوم", value: todayCount, color: "text-primary" },
    { icon: TrendingUp, label: "إجمالي اليوم", value: `${todayTotal.toFixed(2)} ر.س`, color: "text-jiwar-blue" },
    { icon: Calendar, label: "المبيعات الآجلة (الشهر)", value: `${monthDeferred.toFixed(2)} ر.س`, color: "text-jiwar-gold" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground font-ibm">{s.label}</span>
            </div>
            <p className="text-xl font-cairo font-bold text-foreground">{loading ? "..." : s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
        <h3 className="font-cairo font-bold text-foreground text-lg mb-4">حالة التسوية حتى نهاية الشهر</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-primary/5 rounded-xl p-3 text-center">
            <CheckCircle2 className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground font-ibm">تمت تسويته</p>
            <p className="font-cairo font-bold text-primary">{settled.toFixed(2)}</p>
          </div>
          <div className="bg-jiwar-gold/10 rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 text-jiwar-gold mx-auto mb-1" />
            <p className="text-xs text-muted-foreground font-ibm">قيد التحويل</p>
            <p className="font-cairo font-bold text-jiwar-gold">{pending.toFixed(2)}</p>
          </div>
          <div className="bg-muted rounded-xl p-3 text-center">
            <Calendar className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground font-ibm">متبقّي</p>
            <p className="font-cairo font-bold text-foreground">{remaining.toFixed(2)}</p>
          </div>
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground font-ibm text-center py-2">لا توجد تحويلات هذا الشهر</p>
        ) : (
          <div className="space-y-2">
            {transfers.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                <div>
                  <p className="font-cairo font-bold text-foreground">{Number(t.amount).toFixed(2)} ر.س</p>
                  <p className="text-xs text-muted-foreground font-ibm">{new Date(t.created_at).toLocaleDateString("ar-SA")}</p>
                </div>
                <Badge variant={t.status === "completed" ? "default" : "secondary"} className="font-cairo">
                  {t.status === "completed" ? "مكتمل" : t.status === "pending" ? "قيد المراجعة" : t.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantSettlementsPanel;
