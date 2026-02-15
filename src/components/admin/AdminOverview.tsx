import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DollarSign, Store, Users, Receipt } from "lucide-react";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    merchants: 0,
    customers: 0,
    transactions: 0,
    totalVolume: 0,
  });
  const [recentTxs, setRecentTxs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [m, c, t] = await Promise.all([
        supabase.from("merchants").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("amount"),
      ]);

      const txData = t.data || [];
      const volume = txData.reduce((sum, tx) => sum + Number(tx.amount), 0);

      setStats({
        merchants: m.count || 0,
        customers: c.count || 0,
        transactions: txData.length,
        totalVolume: volume,
      });

      // Recent transactions
      const { data: recent } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentTxs(recent || []);
    };
    load();
  }, []);

  const cards = [
    { icon: Store, label: "التجار", value: stats.merchants, color: "text-primary" },
    { icon: Users, label: "العملاء", value: stats.customers, color: "text-jiwar-blue" },
    { icon: Receipt, label: "المعاملات", value: stats.transactions, color: "text-jiwar-gold" },
    { icon: DollarSign, label: "حجم التداول", value: `${stats.totalVolume} ر.س`, color: "text-primary" },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold text-foreground">نظرة عامة</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-muted-foreground font-ibm">{card.label}</span>
            </div>
            <p className="text-2xl font-cairo font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
        <h2 className="font-cairo font-bold text-foreground text-lg mb-4">آخر المعاملات</h2>
        {recentTxs.length === 0 ? (
          <p className="text-muted-foreground text-center py-6 font-ibm">لا توجد معاملات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-2">رقم المعاملة</th>
                  <th className="text-right py-3 px-2">المبلغ</th>
                  <th className="text-right py-3 px-2">الحالة</th>
                  <th className="text-right py-3 px-2">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentTxs.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50">
                    <td className="py-3 px-2 font-cairo text-foreground">{tx.id.slice(0, 8)}...</td>
                    <td className="py-3 px-2 font-cairo font-bold text-primary">{tx.amount} ر.س</td>
                    <td className="py-3 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-cairo ${
                        tx.status === "completed" ? "bg-primary/10 text-primary" : "bg-jiwar-gold/10 text-jiwar-gold"
                      }`}>
                        {tx.status === "completed" ? "مكتملة" : "معلّقة"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground font-ibm text-xs">
                      {new Date(tx.created_at).toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;
