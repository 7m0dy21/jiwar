import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setTransactions(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold text-foreground">المعاملات</h1>
        <Badge variant="secondary" className="font-cairo">{transactions.length} معاملة</Badge>
        <Badge variant="outline" className="font-cairo mr-auto">إجمالي: {totalVolume} ر.س</Badge>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8 font-ibm">جارٍ التحميل...</p>
      ) : transactions.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-card">
          <p className="text-muted-foreground font-ibm">لا توجد معاملات حتى الآن</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">رقم المعاملة</th>
                  <th className="text-right py-3 px-4">المبلغ</th>
                  <th className="text-right py-3 px-4">الحالة</th>
                  <th className="text-right py-3 px-4">التاريخ</th>
                  <th className="text-right py-3 px-4">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4 font-cairo text-foreground">{tx.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4 font-cairo font-bold text-primary">{tx.amount} ر.س</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={tx.status === "completed" ? "default" : tx.status === "cancelled" ? "destructive" : "secondary"}
                        className="font-cairo"
                      >
                        {tx.status === "completed" ? "مكتملة" : tx.status === "cancelled" ? "ملغاة" : "معلّقة"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-ibm">
                      {new Date(tx.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-ibm text-xs" dir="ltr">
                      {new Date(tx.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;
