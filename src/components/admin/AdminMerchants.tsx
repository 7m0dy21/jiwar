import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const AdminMerchants = () => {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merchants")
      .select("*, profiles!merchants_user_id_fkey(full_name, phone)")
      .order("created_at", { ascending: false });
    setMerchants(data || []);
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
                  <th className="text-right py-3 px-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4 font-cairo font-bold text-foreground">{m.store_name || "—"}</td>
                    <td className="py-3 px-4 font-cairo text-foreground">{(m.profiles as any)?.full_name || "—"}</td>
                    <td className="py-3 px-4 font-ibm text-muted-foreground" dir="ltr">{(m.profiles as any)?.phone || "—"}</td>
                    <td className="py-3 px-4 font-ibm text-muted-foreground">{m.store_address || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge variant={m.is_active ? "default" : "secondary"} className="font-cairo">
                        {m.is_active ? "مفعّل" : "معطّل"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant={m.is_active ? "outline" : "default"}
                        onClick={() => toggleActive(m.id, m.is_active)}
                        className={`font-cairo text-xs ${!m.is_active ? "bg-gradient-primary text-primary-foreground" : ""}`}
                      >
                        {m.is_active ? "إيقاف" : "تفعيل"}
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

export default AdminMerchants;
