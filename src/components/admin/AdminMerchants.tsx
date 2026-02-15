import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Pencil, UserPlus, Send } from "lucide-react";

const AdminMerchants = () => {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deleteMerchant, setDeleteMerchant] = useState<any>(null);
  const [editMerchant, setEditMerchant] = useState<any>(null);
  const [transferMerchant, setTransferMerchant] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({ storeName: "", storeAddress: "", iban: "", bankName: "" });
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [newMerchant, setNewMerchant] = useState({ email: "", password: "", fullName: "", phone: "", storeName: "" });

  const load = async () => {
    setLoading(true);
    const [merchantsRes, profilesRes, emailsRes] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, phone"),
      supabase.functions.invoke("list-user-emails"),
    ]);

    setMerchants(merchantsRes.data || []);
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
    setProfiles(profileMap);

    const emailMap = new Map<string, string>();
    if (emailsRes.data?.emails) {
      for (const [uid, email] of Object.entries(emailsRes.data.emails as Record<string, string>)) {
        emailMap.set(uid, email);
      }
    }
    setEmails(emailMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("merchants").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success(!current ? "تم تفعيل التاجر" : "تم إيقاف التاجر");
    load();
  };

  const openEditDialog = (m: any) => {
    setEditMerchant(m);
    setEditForm({ storeName: m.store_name || "", storeAddress: m.store_address || "", iban: m.iban || "", bankName: m.bank_name || "" });
  };

  const handleSaveEdit = async () => {
    if (!editMerchant) return;
    setSaving(true);
    const { error } = await supabase.from("merchants").update({
      store_name: editForm.storeName,
      store_address: editForm.storeAddress,
      iban: editForm.iban,
      bank_name: editForm.bankName,
    }).eq("id", editMerchant.id);
    setSaving(false);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تم تحديث بيانات التاجر");
    setEditMerchant(null);
    load();
  };

  const handleTransfer = async () => {
    if (!transferMerchant) return;
    const amt = Number(transferAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("أدخل مبلغاً صالحاً"); return; }
    setSaving(true);

    const { error } = await supabase.from("merchant_transfers").insert({
      merchant_id: transferMerchant.id,
      amount: amt,
      iban: transferMerchant.iban || "",
      bank_name: transferMerchant.bank_name || "",
      status: "completed",
      notes: transferNotes || null,
    });

    setSaving(false);
    if (error) { toast.error("حدث خطأ في التحويل"); return; }
    toast.success(`تم تحويل ${amt} ر.س للتاجر ${transferMerchant.store_name}`);
    setTransferMerchant(null);
    setTransferAmount("");
    setTransferNotes("");
    load();
  };

  const handleAddMerchant = async () => {
    if (!newMerchant.email || !newMerchant.password || !newMerchant.fullName || !newMerchant.storeName) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.signUp({
      email: newMerchant.email.trim(),
      password: newMerchant.password,
      options: {
        data: {
          full_name: newMerchant.fullName.trim(),
          phone: newMerchant.phone.trim(),
          role: "merchant",
          store_name: newMerchant.storeName.trim(),
        },
      },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة التاجر بنجاح");
    setAddDialogOpen(false);
    setNewMerchant({ email: "", password: "", fullName: "", phone: "", storeName: "" });
    setTimeout(() => load(), 1000);
  };

  const handleDelete = async () => {
    if (!deleteMerchant) return;
    setSaving(true);
    const userId = deleteMerchant.user_id;
    const merchantId = deleteMerchant.id;

    await supabase.from("merchant_transfers").delete().eq("merchant_id", merchantId);
    await supabase.from("transactions").delete().eq("merchant_id", merchantId);
    await supabase.from("notifications").delete().eq("user_id", userId);
    await supabase.from("merchants").delete().eq("id", merchantId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("user_id", userId);

    setSaving(false);
    toast.success("تم حذف التاجر بنجاح");
    setDeleteMerchant(null);
    load();
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold text-foreground">إدارة التجار</h1>
        <Badge variant="secondary" className="font-cairo">{merchants.length} تاجر</Badge>
        <Button onClick={() => setAddDialogOpen(true)} className="mr-auto bg-gradient-primary text-primary-foreground font-cairo gap-1">
          <UserPlus className="h-4 w-4" /> إضافة تاجر
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8 font-ibm">جارٍ التحميل...</p>
      ) : merchants.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-card">
          <p className="text-muted-foreground font-ibm">لا يوجد تجار مسجلين حتى الآن</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">اسم المحل</th>
                  <th className="text-right py-3 px-4">صاحب المحل</th>
                  <th className="text-right py-3 px-4">الجوال</th>
                  <th className="text-right py-3 px-4">البريد</th>
                  <th className="text-right py-3 px-4">البنك</th>
                  <th className="text-right py-3 px-4">الآيبان</th>
                  <th className="text-right py-3 px-4">الحالة</th>
                  <th className="text-right py-3 px-4">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => {
                  const profile = profiles.get(m.user_id);
                  return (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-cairo font-bold text-foreground">{m.store_name || "—"}</td>
                      <td className="py-3 px-4 font-cairo text-foreground">{profile?.full_name || "—"}</td>
                      <td className="py-3 px-4 font-ibm text-muted-foreground" dir="ltr">{profile?.phone || "—"}</td>
                      <td className="py-3 px-4 font-ibm text-muted-foreground text-xs" dir="ltr">{emails.get(m.user_id) || "—"}</td>
                      <td className="py-3 px-4 font-cairo text-muted-foreground text-xs">{m.bank_name || "—"}</td>
                      <td className="py-3 px-4 font-ibm text-muted-foreground text-xs" dir="ltr">{m.iban || "—"}</td>
                      <td className="py-3 px-4">
                        <Badge variant={m.is_active ? "default" : "secondary"} className="font-cairo">
                          {m.is_active ? "مفعّل" : "معطّل"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant={m.is_active ? "outline" : "default"} onClick={() => toggleActive(m.id, m.is_active)}
                            className={`font-cairo text-xs ${!m.is_active ? "bg-gradient-primary text-primary-foreground" : ""}`}>
                            {m.is_active ? "إيقاف" : "تفعيل"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(m)} className="font-cairo text-xs gap-1" title="تعديل">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setTransferMerchant(m); setTransferAmount(""); setTransferNotes(""); }} className="font-cairo text-xs gap-1 text-primary" title="تحويل رصيد">
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteMerchant(m)} className="font-cairo text-xs gap-1 text-destructive hover:text-destructive" title="حذف">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Merchant Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo">إضافة تاجر جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-cairo">الاسم الكامل *</Label>
              <Input value={newMerchant.fullName} onChange={(e) => setNewMerchant(p => ({ ...p, fullName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-cairo">اسم المحل *</Label>
              <Input value={newMerchant.storeName} onChange={(e) => setNewMerchant(p => ({ ...p, storeName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-cairo">البريد الإلكتروني *</Label>
              <Input type="email" value={newMerchant.email} onChange={(e) => setNewMerchant(p => ({ ...p, email: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label className="font-cairo">كلمة المرور *</Label>
              <Input type="password" value={newMerchant.password} onChange={(e) => setNewMerchant(p => ({ ...p, password: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label className="font-cairo">رقم الجوال</Label>
              <Input value={newMerchant.phone} onChange={(e) => setNewMerchant(p => ({ ...p, phone: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="font-cairo">إلغاء</Button>
            <Button onClick={handleAddMerchant} disabled={saving} className="bg-gradient-primary text-primary-foreground font-cairo">
              {saving ? "جارٍ الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Merchant Dialog */}
      <Dialog open={!!editMerchant} onOpenChange={(open) => !open && setEditMerchant(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo">تعديل بيانات التاجر</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-cairo">اسم المحل</Label>
              <Input value={editForm.storeName} onChange={(e) => setEditForm(p => ({ ...p, storeName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-cairo">العنوان</Label>
              <Input value={editForm.storeAddress} onChange={(e) => setEditForm(p => ({ ...p, storeAddress: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-cairo">اسم البنك</Label>
              <Input value={editForm.bankName} onChange={(e) => setEditForm(p => ({ ...p, bankName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-cairo">رقم الآيبان (IBAN)</Label>
              <Input value={editForm.iban} onChange={(e) => setEditForm(p => ({ ...p, iban: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMerchant(null)} className="font-cairo">إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-gradient-primary text-primary-foreground font-cairo">
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferMerchant} onOpenChange={(open) => !open && setTransferMerchant(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo">تحويل رصيد للتاجر</DialogTitle>
          </DialogHeader>
          {transferMerchant && (
            <div className="space-y-4">
              <p className="text-sm font-ibm">
                التاجر: <span className="font-cairo font-bold text-foreground">{transferMerchant.store_name}</span>
              </p>
              {transferMerchant.bank_name && (
                <p className="text-sm font-ibm text-muted-foreground">
                  البنك: <span className="font-bold">{transferMerchant.bank_name}</span>
                  {transferMerchant.iban && <> — IBAN: <span className="font-bold" dir="ltr">{transferMerchant.iban}</span></>}
                </p>
              )}
              <div>
                <Label className="font-cairo">المبلغ (ر.س)</Label>
                <Input type="number" min="0" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label className="font-cairo">ملاحظات (اختياري)</Label>
                <Input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferMerchant(null)} className="font-cairo">إلغاء</Button>
            <Button onClick={handleTransfer} disabled={saving} className="bg-gradient-primary text-primary-foreground font-cairo">
              {saving ? "جارٍ التحويل..." : "تأكيد التحويل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteMerchant} onOpenChange={(open) => !open && setDeleteMerchant(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo text-destructive">تأكيد حذف التاجر</DialogTitle>
            <DialogDescription className="font-ibm">
              سيتم حذف التاجر وجميع بياناته. هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          {deleteMerchant && (
            <p className="text-sm font-ibm">
              التاجر: <span className="font-cairo font-bold text-foreground">{deleteMerchant.store_name}</span>
              {" — "}
              <span className="text-muted-foreground">{profiles.get(deleteMerchant.user_id)?.full_name || ""}</span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMerchant(null)} className="font-cairo">إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="font-cairo">
              {saving ? "جارٍ الحذف..." : "حذف نهائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMerchants;
