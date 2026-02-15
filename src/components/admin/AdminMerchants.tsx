import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const AdminMerchants = () => {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deleteMerchant, setDeleteMerchant] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [merchantsRes, profilesRes] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, phone"),
    ]);

    setMerchants(merchantsRes.data || []);
    const profileMap = new Map(
      (profilesRes.data || []).map((p) => [p.user_id, p])
    );
    setProfiles(profileMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("merchants")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success(!current ? "تم تفعيل التاجر" : "تم إيقاف التاجر");
    load();
  };

  const handleDelete = async () => {
    if (!deleteMerchant) return;
    setSaving(true);

    const userId = deleteMerchant.user_id;
    const merchantId = deleteMerchant.id;

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
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold text-foreground">إدارة التجار</h1>
        <Badge variant="secondary" className="font-cairo">{merchants.length} تاجر</Badge>
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
                  <th className="text-right py-3 px-4">العنوان</th>
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
                      <td className="py-3 px-4 font-ibm text-muted-foreground">{m.store_address || "—"}</td>
                      <td className="py-3 px-4">
                        <Badge variant={m.is_active ? "default" : "secondary"} className="font-cairo">
                          {m.is_active ? "مفعّل" : "معطّل"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={m.is_active ? "outline" : "default"}
                            onClick={() => toggleActive(m.id, m.is_active)}
                            className={`font-cairo text-xs ${!m.is_active ? "bg-gradient-primary text-primary-foreground" : ""}`}
                          >
                            {m.is_active ? "إيقاف" : "تفعيل"}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteMerchant} onOpenChange={(open) => !open && setDeleteMerchant(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo text-destructive">تأكيد حذف التاجر</DialogTitle>
            <DialogDescription className="font-ibm">
              سيتم حذف التاجر وجميع بياناته (المعاملات). هذا الإجراء لا يمكن التراجع عنه.
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
