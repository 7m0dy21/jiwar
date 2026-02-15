import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const AdminCustomers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customers")
        .select("*, profiles!customers_user_id_fkey(full_name, phone, national_id)")
        .order("created_at", { ascending: false });
      setCustomers(data || []);
      setLoading(false);
    };
    load();
  }, []);

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
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const owed = Number(c.credit_limit) - Number(c.available_balance);
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-cairo font-bold text-foreground">{(c.profiles as any)?.full_name || "—"}</td>
                      <td className="py-3 px-4 font-ibm text-muted-foreground" dir="ltr">{(c.profiles as any)?.phone || "—"}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
