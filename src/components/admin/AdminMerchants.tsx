import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface Row {
  uid: string; merchant_id: string; store_name: string; email: string;
  phone: string | null; wallet_balance: number; created_at: number | null;
}

const AdminMerchants = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(getDb(), "merchants"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          uid: d.id, merchant_id: x.merchant_id ?? "", store_name: x.store_name ?? "",
          email: x.email ?? "", phone: x.phone ?? null,
          wallet_balance: typeof x.wallet_balance === "number" ? x.wallet_balance : 0,
          created_at: x.created_at?.toMillis?.() ?? null,
        };
      }));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">التجار</h1>
        <Badge variant="secondary" className="font-cairo">{rows.length}</Badge>
      </div>

      {loading ? <p className="text-muted-foreground text-center py-8 font-ibm">جارٍ التحميل...</p>
      : rows.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center shadow-card">
          <p className="text-muted-foreground font-ibm">لا يوجد تجار</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">المعرف</th>
                  <th className="text-right py-3 px-4">اسم المتجر</th>
                  <th className="text-right py-3 px-4">البريد</th>
                  <th className="text-right py-3 px-4">الجوال</th>
                  <th className="text-right py-3 px-4">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} className="border-b hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono text-primary" dir="ltr">{r.merchant_id}</td>
                    <td className="py-3 px-4 font-cairo">{r.store_name || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground" dir="ltr">{r.email}</td>
                    <td className="py-3 px-4 text-muted-foreground" dir="ltr">{r.phone || "—"}</td>
                    <td className="py-3 px-4 font-cairo font-bold">{r.wallet_balance.toFixed(2)} ر.س</td>
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

export default AdminMerchants;
