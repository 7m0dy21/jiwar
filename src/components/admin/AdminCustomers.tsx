import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { setCustomerVerified } from "@/lib/firebaseCustomers";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Row {
  uid: string; account_number: string; full_name: string; email: string;
  phone: string | null; wallet_balance: number; is_verified: boolean;
  is_frozen: boolean; payment_limit: number; debt_due_date: number | null;
  created_at: number | null;
}

const AdminCustomers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, { limit?: string; due?: string }>>({});

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
          is_frozen: x.is_frozen === true,
          payment_limit: typeof x.payment_limit === "number" ? x.payment_limit : 5000,
          debt_due_date: x.debt_due_date?.toMillis?.() ?? (typeof x.debt_due_date === "number" ? x.debt_due_date : null),
          created_at: x.created_at?.toMillis?.() ?? null,
        };
      }));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const toggleVerify = async (uid: string, current: boolean) => {
    try { await setCustomerVerified(uid, !current); toast.success(current ? "تم إلغاء التوثيق" : "تم توثيق العميل"); }
    catch (e: any) { toast.error(e?.message || "فشل التحديث"); }
  };
  const toggleFreeze = async (uid: string, current: boolean) => {
    try { await updateDoc(doc(getDb(), "customers", uid), { is_frozen: !current });
      toast.success(current ? "تم رفع التجميد" : "تم تجميد الحساب"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
  };
  const saveLimit = async (uid: string) => {
    const v = parseFloat(edits[uid]?.limit ?? "");
    if (!Number.isFinite(v) || v < 0) { toast.error("قيمة غير صالحة"); return; }
    try { await updateDoc(doc(getDb(), "customers", uid), { payment_limit: v });
      toast.success("تم تحديث الحد"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
  };
  const saveDue = async (uid: string) => {
    const v = edits[uid]?.due;
    if (!v) return;
    try { await updateDoc(doc(getDb(), "customers", uid), { debt_due_date: new Date(v).getTime() });
      toast.success("تم تحديث تاريخ السداد"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
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
                  <th className="text-right py-3 px-3">رقم الحساب</th>
                  <th className="text-right py-3 px-3">الاسم</th>
                  <th className="text-right py-3 px-3">الرصيد</th>
                  <th className="text-right py-3 px-3">حد الدفع</th>
                  <th className="text-right py-3 px-3">موعد السداد</th>
                  <th className="text-right py-3 px-3">الحالة</th>
                  <th className="text-right py-3 px-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} className="border-b hover:bg-muted/20 align-top">
                    <td className="py-3 px-3 font-mono text-primary" dir="ltr">{r.account_number}</td>
                    <td className="py-3 px-3 font-cairo">
                      <p>{r.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
                    </td>
                    <td className="py-3 px-3 font-cairo font-bold" dir="ltr">{r.wallet_balance.toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        <Input dir="ltr" className="h-8 w-24" type="number"
                          defaultValue={r.payment_limit}
                          onChange={(e) => setEdits((p) => ({ ...p, [r.uid]: { ...p[r.uid], limit: e.target.value } }))} />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => saveLimit(r.uid)}>حفظ</Button>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        <Input type="date" className="h-8 w-36"
                          defaultValue={r.debt_due_date ? new Date(r.debt_due_date).toISOString().slice(0, 10) : ""}
                          onChange={(e) => setEdits((p) => ({ ...p, [r.uid]: { ...p[r.uid], due: e.target.value } }))} />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => saveDue(r.uid)}>حفظ</Button>
                      </div>
                    </td>
                    <td className="py-3 px-3 space-y-1">
                      <Badge variant={r.is_verified ? "default" : "destructive"} className="font-cairo block w-fit">
                        {r.is_verified ? "موثّق" : "غير موثّق"}
                      </Badge>
                      {r.is_frozen && <Badge variant="destructive" className="font-cairo block w-fit">مجمّد</Badge>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant={r.is_verified ? "outline" : "default"} onClick={() => toggleVerify(r.uid, r.is_verified)}>
                          {r.is_verified ? "إلغاء التوثيق" : "توثيق"}
                        </Button>
                        <Button size="sm" variant={r.is_frozen ? "outline" : "destructive"} onClick={() => toggleFreeze(r.uid, r.is_frozen)}>
                          {r.is_frozen ? "رفع التجميد" : "تجميد"}
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

export default AdminCustomers;
