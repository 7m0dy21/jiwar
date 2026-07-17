import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string; account_number: string; merchant_id: string;
  amount: number; status: string; created_at: number | null;
}

const AdminTransactions = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(getDb(), "transactions"), orderBy("created_at", "desc"), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id, account_number: x.account_number ?? "",
          merchant_id: x.merchant_id ?? "",
          amount: Number(x.amount) || 0, status: x.status ?? "pending",
          created_at: x.created_at?.toMillis?.() ?? null,
        };
      }));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const totalVolume = rows.filter((r) => r.status === "completed").reduce((s, t) => s + t.amount, 0);

  const statusBadge = (s: string) => {
    if (s === "completed") return <Badge className="font-cairo">مكتملة</Badge>;
    if (s === "declined") return <Badge variant="destructive" className="font-cairo">مرفوضة</Badge>;
    if (s === "failed") return <Badge variant="destructive" className="font-cairo">فشل</Badge>;
    return <Badge variant="secondary" className="font-cairo">قيد الانتظار</Badge>;
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">المعاملات</h1>
        <Badge variant="secondary" className="font-cairo">{rows.length}</Badge>
        <Badge variant="outline" className="font-cairo mr-auto">إجمالي مكتمل: {totalVolume.toFixed(2)} ر.س</Badge>
      </div>

      {loading ? <p className="text-muted-foreground text-center py-8 font-ibm">جارٍ التحميل...</p>
      : rows.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center shadow-card">
          <p className="text-muted-foreground font-ibm">لا توجد معاملات</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">المرجع</th>
                  <th className="text-right py-3 px-4">رقم الحساب</th>
                  <th className="text-right py-3 px-4">التاجر</th>
                  <th className="text-right py-3 px-4">المبلغ</th>
                  <th className="text-right py-3 px-4">الحالة</th>
                  <th className="text-right py-3 px-4">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono text-xs" dir="ltr">{r.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4 font-mono" dir="ltr">{r.account_number}</td>
                    <td className="py-3 px-4 font-mono" dir="ltr">{r.merchant_id}</td>
                    <td className="py-3 px-4 font-cairo font-bold text-primary">{r.amount.toFixed(2)} ر.س</td>
                    <td className="py-3 px-4">{statusBadge(r.status)}</td>
                    <td className="py-3 px-4 text-muted-foreground font-ibm text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleString("ar-SA") : "—"}
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
