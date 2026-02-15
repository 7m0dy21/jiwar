import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, Shield, ShieldCheck, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  permissions: {
    id: string;
    can_manage_customers: boolean;
    can_manage_merchants: boolean;
    can_manage_transactions: boolean;
    can_manage_admins: boolean;
    can_view_reports: boolean;
    is_super_admin: boolean;
  };
  created_at: string;
}

interface PermissionsForm {
  can_manage_customers: boolean;
  can_manage_merchants: boolean;
  can_manage_transactions: boolean;
  can_manage_admins: boolean;
  can_view_reports: boolean;
}

const defaultPermissions: PermissionsForm = {
  can_manage_customers: false,
  can_manage_merchants: false,
  can_manage_transactions: false,
  can_manage_admins: false,
  can_view_reports: true,
};

const permissionLabels: Record<keyof PermissionsForm, string> = {
  can_manage_customers: "إدارة العملاء",
  can_manage_merchants: "إدارة التجار",
  can_manage_transactions: "إدارة المعاملات",
  can_manage_admins: "إدارة المشرفين",
  can_view_reports: "عرض التقارير",
};

const AdminManagers = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPerms, setNewPerms] = useState<PermissionsForm>(defaultPermissions);

  // Edit form
  const [editPerms, setEditPerms] = useState<PermissionsForm>(defaultPermissions);

  const loadAdmins = async () => {
    setLoading(true);

    // Get all admin permissions
    const { data: permsData } = await supabase
      .from("admin_permissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!permsData || permsData.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }

    // Get profiles for these users
    const userIds = permsData.map((p: any) => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", userIds);

    const adminList: AdminUser[] = permsData.map((perm: any) => {
      const profile = profiles?.find((p: any) => p.user_id === perm.user_id);
      return {
        user_id: perm.user_id,
        full_name: profile?.full_name || "غير معروف",
        email: "",
        phone: profile?.phone || null,
        permissions: {
          id: perm.id,
          can_manage_customers: perm.can_manage_customers,
          can_manage_merchants: perm.can_manage_merchants,
          can_manage_transactions: perm.can_manage_transactions,
          can_manage_admins: perm.can_manage_admins,
          can_view_reports: perm.can_view_reports,
          is_super_admin: perm.is_super_admin,
        },
        created_at: perm.created_at,
      };
    });

    setAdmins(adminList);
    setLoading(false);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-admin", {
        body: {
          email: newEmail,
          password: newPassword,
          full_name: newName,
          phone: newPhone,
          permissions: newPerms,
        },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "حدث خطأ");
      }

      toast.success("تم إنشاء حساب المشرف بنجاح");
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewPhone("");
      setNewPerms(defaultPermissions);
      loadAdmins();
    } catch (err: any) {
      toast.error(err.message || "فشل إنشاء الحساب");
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditPerms({
      can_manage_customers: admin.permissions.can_manage_customers,
      can_manage_merchants: admin.permissions.can_manage_merchants,
      can_manage_transactions: admin.permissions.can_manage_transactions,
      can_manage_admins: admin.permissions.can_manage_admins,
      can_view_reports: admin.permissions.can_view_reports,
    });
    setEditOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("admin_permissions")
        .update(editPerms as any)
        .eq("id", editingAdmin.permissions.id);

      if (error) throw error;
      toast.success("تم تحديث الصلاحيات بنجاح");
      setEditOpen(false);
      loadAdmins();
    } catch (err: any) {
      toast.error(err.message || "فشل تحديث الصلاحيات");
    } finally {
      setSaving(false);
    }
  };

  const activePermsCount = (p: AdminUser["permissions"]) => {
    if (p.is_super_admin) return "مشرف رئيسي";
    const count = [p.can_manage_customers, p.can_manage_merchants, p.can_manage_transactions, p.can_manage_admins, p.can_view_reports].filter(Boolean).length;
    return `${count} صلاحيات`;
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="text-2xl font-cairo font-bold text-foreground">إدارة المشرفين</h1>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-cairo gap-2">
              <UserPlus className="w-4 h-4" />
              إضافة مشرف
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-cairo">إنشاء حساب مشرف جديد</DialogTitle>
              <DialogDescription className="font-ibm">أدخل بيانات المشرف الجديد وحدد صلاحياته</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="font-cairo">الاسم الكامل *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المشرف" className="mt-1" dir="rtl" />
              </div>
              <div>
                <Label className="font-cairo">البريد الإلكتروني *</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" type="email" className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label className="font-cairo">كلمة المرور *</Label>
                <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة مرور قوية" type="password" className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label className="font-cairo">رقم الجوال</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="05xxxxxxxx" className="mt-1" dir="ltr" />
              </div>

              <div className="border border-border rounded-xl p-4">
                <p className="font-cairo font-bold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  الصلاحيات
                </p>
                <div className="space-y-3">
                  {(Object.keys(permissionLabels) as (keyof PermissionsForm)[]).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="font-ibm text-sm">{permissionLabels[key]}</Label>
                      <Switch
                        checked={newPerms[key]}
                        onCheckedChange={(val) => setNewPerms((p) => ({ ...p, [key]: val }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleCreate} disabled={creating} className="w-full font-cairo">
                {creating ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit permissions dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo">تعديل صلاحيات {editingAdmin?.full_name}</DialogTitle>
            <DialogDescription className="font-ibm">قم بتعديل صلاحيات هذا المشرف</DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-xl p-4 mt-4">
            <div className="space-y-3">
              {(Object.keys(permissionLabels) as (keyof PermissionsForm)[]).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="font-ibm text-sm">{permissionLabels[key]}</Label>
                  <Switch
                    checked={editPerms[key]}
                    onCheckedChange={(val) => setEditPerms((p) => ({ ...p, [key]: val }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleSavePermissions} disabled={saving} className="w-full font-cairo mt-4">
            {saving ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Admins list */}
      {loading ? (
        <p className="text-muted-foreground font-ibm text-center py-12">جارٍ التحميل...</p>
      ) : admins.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-ibm">لا يوجد مشرفين حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map((admin) => (
            <div key={admin.user_id} className="bg-card border border-border rounded-2xl p-5 shadow-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    {admin.permissions.is_super_admin ? (
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    ) : (
                      <Shield className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-cairo font-bold text-foreground">{admin.full_name}</p>
                    {admin.phone && (
                      <p className="text-xs text-muted-foreground font-ibm">{admin.phone}</p>
                    )}
                  </div>
                </div>
                {!admin.permissions.is_super_admin && (
                  <Button variant="ghost" size="icon" onClick={() => handleEditOpen(admin)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant={admin.permissions.is_super_admin ? "default" : "secondary"}
                  className="text-xs"
                >
                  {activePermsCount(admin.permissions)}
                </Badge>
              </div>

              <div className="space-y-1.5">
                {(Object.keys(permissionLabels) as (keyof PermissionsForm)[]).map((key) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="font-ibm text-muted-foreground">{permissionLabels[key]}</span>
                    <span className={admin.permissions[key] || admin.permissions.is_super_admin ? "text-primary font-bold" : "text-muted-foreground/50"}>
                      {admin.permissions[key] || admin.permissions.is_super_admin ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground/60 font-ibm mt-3 pt-3 border-t border-border/50">
                تاريخ الإنشاء: {new Date(admin.created_at).toLocaleDateString("ar-SA")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminManagers;
