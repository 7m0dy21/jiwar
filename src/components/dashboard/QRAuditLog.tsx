import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, XCircle, Clock, CheckCircle2, Ban } from "lucide-react";

interface Props {
  scope: "customer" | "merchant";
  entityId: string;
}

const eventMeta: Record<string, { label: string; icon: any; variant: "default"|"secondary"|"destructive"|"outline" }> = {
  generated: { label: "تم التوليد", icon: ShieldCheck, variant: "secondary" },
  paid: { label: "تمت العملية", icon: CheckCircle2, variant: "default" },
  expired: { label: "انتهت الصلاحية", icon: Clock, variant: "outline" },
  invalid_signature: { label: "توقيع غير صالح", icon: XCircle, variant: "destructive" },
  insufficient_balance: { label: "رصيد غير كافٍ", icon: AlertTriangle, variant: "destructive" },
  limit_exceeded: { label: "تجاوز الحد", icon: Ban, variant: "destructive" },
  rejected: { label: "مرفوضة", icon: XCircle, variant: "destructive" },
};

const QRAuditLog = ({ scope, entityId }: Props) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    const load = async () => {
      setLoading(true);
      const col = scope === "customer" ? "customer_id" : "merchant_id";
      const { data } = await supabase
        .from("qr_audit_log").select("*")
        .eq(col, entityId).order("created_at", { ascending: false }).limit(100);
      setRows(data || []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`qr_audit_${scope}_${entityId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "qr_audit_log" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [scope, entityId]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="font-cairo font-bold text-foreground text-lg">سجل تدقيق كود الدفع</h2>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground font-ibm">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground font-ibm text-center py-4">لا توجد سجلات بعد</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((r) => {
            const meta = eventMeta[r.event_type] || { label: r.event_type, icon: ShieldCheck, variant: "outline" as const };
            const Icon = meta.icon;
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2">
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.variant} className="font-cairo text-xs">{meta.label}</Badge>
                      {r.amount && <span className="text-sm font-bold text-foreground font-ibm">{Number(r.amount).toFixed(2)} ر.س</span>}
                    </div>
                    {r.reason && <p className="text-xs text-muted-foreground font-ibm mt-1">{r.reason}</p>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-ibm whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QRAuditLog;
