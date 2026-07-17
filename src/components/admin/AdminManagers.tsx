import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { promoteToAdmin, demoteAdmin, subscribeAdmins, type AdminRecord } from "@/lib/firebaseAdmins";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";

interface UserRow {
  uid: string; email: string; full_name: string;
  kind: "customer" | "merchant"; label: string;
}

const AdminManagers = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeAdmins(setAdmins), []);

  useEffect(() => {
    let c: UserRow[] = [];
    let m: UserRow[] = [];
    const merge = () => setUsers([...c, ...m].sort((a, b) => a.email.localeCompare(b.email)));

    const unsubC = onSnapshot(collection(getDb(), "customers"), (snap) => {
      c = snap.docs.map((d) => {
        const x = d.data() as any;
        return { uid: d.id, email: x.email ?? "", full_name: x.full_name ?? "",
          kind: "customer" as const, label: x.account_number ?? "" };
      });
      merge(); setLoading(false);
    });
    const unsubM = onSnapshot(collection(getDb(), "merchants"), (snap) => {
      m = snap.docs.map((d) => {
        const x = d.data() as any;
        return { uid: d.id, email: x.email ?? "", full_name: x.store_name ?? "",
          kind: "merchant" as const, label: x.merchant_id ?? "" };
      });
      merge(); setLoading(false);
    });
    return () => { unsubC(); unsubM(); };
  }, []);

  const adminUids = new Set(admins.map((a) => a.uid));

  const promote = async (u: UserRow) => {
    try {
      await promoteToAdmin(u.uid, { email: u.email, full_name: u.full_name });
      toast.success("تم منح صلاحيات المشرف");
    } catch (e: any) {
      toast.error(e?.message || "فشل - تأكد من قواعد admins في firestore.rules");
    }
  };
  const demote = async (uid: string) => {
    if (uid === user?.uid) { toast.error("لا يمكنك إزالة صلاحياتك بنفسك"); return; }
    try {
      await demoteAdmin(uid);
      toast.success("تمت إزالة صلاحيات المشرف");
    } catch (e: any) {
      toast.error(e?.message || "فشل");
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">إدارة المشرفين</h1>
        <Badge variant="secondary" className="font-cairo">{admins.length} مشرف</Badge>
      </div>

      <div className="bg-card border rounded-2xl p-6 mb-6 shadow-card">
        <h2 className="font-cairo font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> المشرفون الحاليون</h2>
        {admins.length === 0 ? (
          <p className="text-muted-foreground text-sm">لا يوجد مشرفون بعد. أضف نفسك من Firebase Console أولاً في مجموعة admins.</p>
        ) : (
          <ul className="space-y-2">
            {admins.map((a) => (
              <li key={a.uid} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-cairo font-bold">{a.full_name || a.email || a.uid}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{a.email || a.uid}</p>
                </div>
                <Button size="sm" variant="outline" disabled={a.uid === user?.uid} onClick={() => demote(a.uid)}>
                  {a.uid === user?.uid ? "أنت" : "إزالة المشرف"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-card border rounded-2xl p-6 shadow-card">
        <h2 className="font-cairo font-bold mb-4">جميع المستخدمين</h2>
        {loading ? <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
        : users.length === 0 ? <p className="text-muted-foreground text-sm">لا يوجد مستخدمون</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">النوع</th>
                  <th className="text-right py-3 px-4">الاسم</th>
                  <th className="text-right py-3 px-4">البريد</th>
                  <th className="text-right py-3 px-4">المعرف</th>
                  <th className="text-right py-3 px-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = adminUids.has(u.uid);
                  return (
                    <tr key={u.uid} className="border-b hover:bg-muted/20">
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-cairo">{u.kind === "customer" ? "عميل" : "تاجر"}</Badge>
                      </td>
                      <td className="py-3 px-4 font-cairo">{u.full_name || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground" dir="ltr">{u.email}</td>
                      <td className="py-3 px-4 font-mono text-xs" dir="ltr">{u.label}</td>
                      <td className="py-3 px-4">
                        {isAdmin ? (
                          <Badge className="font-cairo">مشرف</Badge>
                        ) : (
                          <Button size="sm" onClick={() => promote(u)}>ترقية لمشرف</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminManagers;
