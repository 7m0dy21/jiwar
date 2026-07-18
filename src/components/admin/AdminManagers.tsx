import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { promoteToAdmin, demoteAdmin, setAdminPermission, subscribeAdmins, type AdminRecord, type AdminPermission } from "@/lib/firebaseAdmins";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";

interface UserRow {
  uid: string; email: string; full_name: string;
  kind: "customer" | "merchant"; label: string;
}

const permissionLabels: Record<AdminPermission, string> = {
  view_only: "عرض فقط",
  edit_limits: "تعديل الحدود",
  full_access: "صلاحيات كاملة",
};

const AdminManagers = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeAdmins(setAdmins), []);

  useEffect(() => {
    let c: UserRow[] = [], m: UserRow[] = [];
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
    try { await promoteToAdmin(u.uid, { email: u.email, full_name: u.full_name, permission: "view_only" });
      toast.success("تم منح صلاحيات المشرف"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
  };
  const demote = async (uid: string) => {
    if (uid === user?.uid) { toast.error("لا يمكنك إزالة صلاحياتك بنفسك"); return; }
    try { await demoteAdmin(uid); toast.success("تمت إزالة صلاحيات المشرف"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
  };
  const changePerm = async (uid: string, perm: AdminPermission) => {
    try { await setAdminPermission(uid, perm); toast.success("تم تحديث الصلاحيات"); }
    catch (e: any) { toast.error(e?.message || "فشل"); }
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
          <p className="text-muted-foreground text-sm">لا يوجد مشرفون بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-2">الاسم</th>
                  <th className="text-right py-2 px-2">البريد</th>
                  <th className="text-right py-2 px-2">الصلاحيات</th>
                  <th className="text-right py-2 px-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.uid} className="border-b hover:bg-muted/20">
                    <td className="py-3 px-2 font-cairo">
                      {a.full_name || "—"}
                      {a.uid === user?.uid && <Badge variant="outline" className="mr-2">أنت</Badge>}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground text-xs" dir="ltr">{a.email || a.uid}</td>
                    <td className="py-3 px-2">
                      <Select value={a.permission ?? "view_only"} onValueChange={(v) => changePerm(a.uid, v as AdminPermission)}>
                        <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view_only">{permissionLabels.view_only}</SelectItem>
                          <SelectItem value="edit_limits">{permissionLabels.edit_limits}</SelectItem>
                          <SelectItem value="full_access">{permissionLabels.full_access}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-2">
                      <Button size="sm" variant="outline" disabled={a.uid === user?.uid} onClick={() => demote(a.uid)}>
                        إزالة
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-2xl p-6 shadow-card">
        <h2 className="font-cairo font-bold mb-4">إضافة مشرف من المستخدمين</h2>
        {loading ? <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
        : users.length === 0 ? <p className="text-muted-foreground text-sm">لا يوجد مستخدمون</p>
        : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">النوع</th>
                  <th className="text-right py-3 px-4">الاسم</th>
                  <th className="text-right py-3 px-4">البريد</th>
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
                      <td className="py-3 px-4 text-muted-foreground text-xs" dir="ltr">{u.email}</td>
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
