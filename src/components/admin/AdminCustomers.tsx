import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

const AdminCustomers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [customersRes, profilesRes] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, phone, national_id"),
    ]);

    console.log("Customers query result:", customersRes.data?.length, "error:", customersRes.error?.message);
    console.log("Profiles query result:", profilesRes.data?.length, "error:", profilesRes.error?.message);

    setCustomers(customersRes.data || []);
    const profileMap = new Map(
      (profilesRes.data || []).map((p) => [p.user_id, p])
    );
    setProfiles(profileMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditDialog = (customer: any) => {
    setEditCustomer(customer);
    setNewCreditLimit(String(customer.credit_limit));
  };

  const handleSaveCreditLimit = async () => {
    if (!editCustomer) return;
    const limit = Number(newCreditLimit);
    if (isNaN(limit) || limit < 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    setSaving(true);
    const oldLimit = Number(editCustomer.credit_limit);
    const diff = limit - oldLimit;
    const newBalance = Number(editCustomer.available_balance) + diff;

    const { error } = await supabase
      .from("customers")
      .update({
        credit_limit: limit,
        available_balance: Math.max(0, newBalance),
      })
      .eq("id", editCustomer.id);

    setSaving(false);
    if (error) {
      toast.error("حدث خطأ أثناء التحديث");
      return;
    }
    toast.success(`تم تحديث الحد الائتماني إلى ${limit} ر.س`);
    setEditCustomer(null);
    load();
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold text-foreground">إدارة العملاء</h1>
        <Badge variant="secondary" className="font-cairo">{customers.length} عميل</Badge>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8 font-ibm">جارٍ التحميل...</p>
      ) : customers.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-card">
          <p className="text-muted-foreground font-ibm">لا يوجد عملاء مسجلين حتى الآن</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-ibm">
                  <th className="text-right py-3 px-4">الاسم</th>
                  <th className="text-right py-3 px-4">الجوال</th>
                  <th className="text-right py-3 px-4">الحد الائتماني</th>
                  <th className="text-right py-3 px-4">الرصيد المتاح</th>
                  <th className="text-right py-3 px-4">المستحق</th>
                  <th className="text-right py-3 px-4">التحقق</th>
                  <th className="text-right py-3 px-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const profile = profiles.get(c.user_id);
                  const owed = Number(c.credit_limit) - Number(c.available_balance);
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-cairo font-bold text-foreground">{profile?.full_name || "—"}</td>
                      <td className="py-3 px-4 font-ibm text-muted-foreground" dir="ltr">{profile?.phone || "—"}</td>
                      <td className="py-3 px-4 font-cairo text-foreground">{c.credit_limit} ر.س</td>
                      <td className="py-3 px-4 font-cairo text-primary font-bold">{c.available_balance} ر.س</td>
                      <td className="py-3 px-4 font-cairo">
                        <span className={owed > 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                          {owed} ر.س
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={c.is_verified ? "default" : "outline"} className="font-cairo">
                          {c.is_verified ? "موثّق" : "غير موثّق"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(c)}
                          className="font-cairo text-xs gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          تعديل الحد
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo">تعديل الحد الائتماني</DialogTitle>
          </DialogHeader>
          {editCustomer && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground font-ibm">
                العميل: <span className="font-cairo font-bold text-foreground">{profiles.get(editCustomer.user_id)?.full_name || "—"}</span>
              </p>
              <p className="text-sm text-muted-foreground font-ibm">
                الحد الحالي: <span className="font-bold text-foreground">{editCustomer.credit_limit} ر.س</span>
              </p>
              <div>
                <Label htmlFor="creditLimit" className="font-cairo">الحد الائتماني الجديد (ر.س)</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  min="0"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomer(null)} className="font-cairo">
              إلغاء
            </Button>
            <Button
              onClick={handleSaveCreditLimit}
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground font-cairo"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;
