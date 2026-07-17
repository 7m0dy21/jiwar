import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { setCustomerVerified } from "@/lib/firebaseCustomers";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Row {
  uid: string; account_number: string; full_name: string; email: string;
  phone: string | null; wallet_balance: number; is_verified: boolean; created_at: number | null;
}

const AdminCustomers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(getDb(), "customers"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          uid: d.id,
          account_number: x.account_number ?? "",
          full_name: x.full_name ?? "",
          email: x.email ?? "",
          phone: x.phone ?? null,
          wallet_balance: typeof x.wallet_balance === "number" ? x.wallet_balance : 0,
          is_verified: x.is_verified === true,
          created_at: x.created_at?.toMillis?.() ?? null,
        };
      }));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const toggleVerify = async (uid: string, current: boolean) => {
    try {
      await setCustomerVerified(uid, !current);
      toast.success(current ? "تم إلغاء التوثيق" : "تم توثيق العميل");
    } catch (e: any) {
      toast.error(e?.message || "فشل التحديث - تأكد أن قواعد Firestore تسمح للأدمن بتحديث بيانات العميل");
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">العملاء</h1>
        <Badge variant="secondary" className="font-cairo">{rows.length}</Badge>
      </div>

      {loading ? <p className="text-muted-foreground text-center py-8 font-ibm">جارٍ التحميل...</p>
      : rows.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center shadow-card">
          <p className="text-muted-foreground font-ibm">لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">رقم الحساب</th>
                  <th className="text-right py-3 px-4">الاسم</th>
                  <th className="text-right py-3 px-4">البريد</th>
                  <th className="text-right py-3 px-4">الرصيد</th>
                  <th className="text-right py-3 px-4">التوثيق</th>
                  <th className="text-right py-3 px-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} className="border-b hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono text-primary" dir="ltr">{r.account_number}</td>
                    <td className="py-3 px-4 font-cairo">{r.full_name || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground" dir="ltr">{r.email}</td>
                    <td className="py-3 px-4 font-cairo font-bold">{r.wallet_balance.toFixed(2)} ر.س</td>
                    <td className="py-3 px-4">
                      <Badge variant={r.is_verified ? "default" : "destructive"} className="font-cairo">
                        {r.is_verified ? "موثّق" : "غير موثّق"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant={r.is_verified ? "outline" : "default"} onClick={() => toggleVerify(r.uid, r.is_verified)}>
                        {r.is_verified ? "إلغاء التوثيق" : "توثيق"}
                      </Button>
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

export default AdminCustomers;
