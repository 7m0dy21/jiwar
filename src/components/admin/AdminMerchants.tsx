import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Row {
  uid: string; merchant_id: string; store_name: string; email: string;
  phone: string | null; wallet_balance: number; is_verified: boolean;
  is_frozen: boolean; receiving_limit: number; iban: string | null;
  created_at: number | null;
}

const AdminMerchants = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(getDb(), "merchants"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          uid: d.id, merchant_id: x.merchant_id ?? "", store_name: x.store_name ?? "",
          email: x.email ?? "", phone: x.phone ?? null,
          wallet_balance: typeof x.wallet_balance === "number" ? x.wallet_balance : 0,
          is_verified: x.is_verified === true,
          is_frozen: x.is_frozen === true,
          receiving_limit: typeof x.receiving_limit === "number" ? x.receiving_limit : 50000,
          iban: x.iban ?? null,
          created_at: x.created_at?.toMillis?.() ?? null,
        };
      }));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const toggle = async (uid: string, field: "is_verified" | "is_frozen", current: boolean, okMsg: string, offMsg: string) => {
    try { await updateDoc(doc(getDb(), "merchants", uid), { [field]: !current });
      toast.success(current ? offMsg : okMsg); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
  };
  const saveLimit = async (uid: string) => {
    const v = parseFloat(edits[uid] ?? "");
    if (!Number.isFinite(v) || v < 0) { toast.error("قيمة غير صالحة"); return; }
    try { await updateDoc(doc(getDb(), "merchants", uid), { receiving_limit: v });
      toast.success("تم تحديث حد الاستقبال"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
  };

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
                  <th className="text-right py-3 px-3">المعرف</th>
                  <th className="text-right py-3 px-3">المتجر</th>
                  <th className="text-right py-3 px-3">الرصيد</th>
                  <th className="text-right py-3 px-3">حد الاستقبال</th>
                  <th className="text-right py-3 px-3">IBAN</th>
                  <th className="text-right py-3 px-3">الحالة</th>
                  <th className="text-right py-3 px-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} className="border-b hover:bg-muted/20 align-top">
                    <td className="py-3 px-3 font-mono text-primary" dir="ltr">{r.merchant_id}</td>
                    <td className="py-3 px-3 font-cairo">
                      <p>{r.store_name || "—"}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
                    </td>
                    <td className="py-3 px-3 font-cairo font-bold" dir="ltr">{r.wallet_balance.toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        <Input dir="ltr" className="h-8 w-24" type="number"
                          defaultValue={r.receiving_limit}
                          onChange={(e) => setEdits((p) => ({ ...p, [r.uid]: e.target.value }))} />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => saveLimit(r.uid)}>حفظ</Button>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs" dir="ltr">
                      {r.iban ? `${r.iban.slice(0, 4)}••${r.iban.slice(-4)}` : "—"}
                    </td>
                    <td className="py-3 px-3 space-y-1">
                      <Badge variant={r.is_verified ? "default" : "secondary"} className="font-cairo block w-fit">
                        {r.is_verified ? "موثّق" : "قيد المراجعة"}
                      </Badge>
                      {r.is_frozen && <Badge variant="destructive" className="font-cairo block w-fit">موقوف</Badge>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant={r.is_verified ? "outline" : "default"}
                          onClick={() => toggle(r.uid, "is_verified", r.is_verified, "تم التوثيق", "تم إلغاء التوثيق")}>
                          {r.is_verified ? "إلغاء التوثيق" : "توثيق"}
                        </Button>
                        <Button size="sm" variant={r.is_frozen ? "outline" : "destructive"}
                          onClick={() => toggle(r.uid, "is_frozen", r.is_frozen, "تم الإيقاف", "تم الاستئناف")}>
                          {r.is_frozen ? "استئناف" : "إيقاف"}
                        </Button>
                      </div>
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

export default AdminMerchants;
