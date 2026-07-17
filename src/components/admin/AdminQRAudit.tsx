import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ShieldQuestion, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/csv";

interface AuditRow {
  id: string;
  customer_id: string | null;
  merchant_id: string | null;
  event_type: string;
  amount: number | null;
  reason: string | null;
  metadata: any;
  created_at: string;
}

const eventColor: Record<string, string> = {
  generated: "bg-blue-100 text-blue-700",
  request_created: "bg-amber-100 text-amber-700",
  request_approved: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  request_rejected: "bg-rose-100 text-rose-700",
  request_expired: "bg-slate-200 text-slate-700",
  expired: "bg-slate-200 text-slate-700",
  invalid_signature: "bg-red-100 text-red-700",
  insufficient_balance: "bg-red-100 text-red-700",
  limit_exceeded: "bg-red-100 text-red-700",
  request_failed: "bg-red-100 text-red-700",
  rejected: "bg-rose-100 text-rose-700",
};

const eventLabel: Record<string, string> = {
  generated: "توليد كود",
  request_created: "طلب دفع",
  request_approved: "موافقة",
  paid: "تسوية ناجحة",
  request_rejected: "رفض العميل",
  request_expired: "انتهاء الطلب",
  expired: "انتهاء الكود",
  invalid_signature: "توقيع غير صالح",
  insufficient_balance: "رصيد غير كافٍ",
  limit_exceeded: "تجاوز الحد",
  request_failed: "فشل الطلب",
  rejected: "مرفوض",
};

const AdminQRAudit = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("qr_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as AuditRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-qr-audit")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "qr_audit_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const exportAudit = () => {
    downloadCSV(
      `qr-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ["التاريخ", "الحدث", "المبلغ", "السبب", "العميل", "التاجر", "بيانات إضافية"],
      filtered.map((r) => [
        new Date(r.created_at).toLocaleString("ar-SA"),
        eventLabel[r.event_type] || r.event_type,
        r.amount != null ? Number(r.amount).toFixed(2) : "",
        r.reason || "",
        r.customer_id || "",
        r.merchant_id || "",
        r.metadata ? JSON.stringify(r.metadata) : "",
      ])
    );
  };

  const exportSettlements = async () => {
    const { data } = await supabase
      .from("merchant_transfers")
      .select("id, merchant_id, amount, status, iban, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    downloadCSV(
      `settlements-${new Date().toISOString().slice(0, 10)}.csv`,
      ["التاريخ", "معرف التحويل", "التاجر", "المبلغ", "الحالة", "IBAN"],
      (data || []).map((t: any) => [
        new Date(t.created_at).toLocaleString("ar-SA"),
        t.id,
        t.merchant_id,
        Number(t.amount).toFixed(2),
        t.status,
        t.iban || "",
      ])
    );
  };

  const filtered = rows.filter((r) =>
    !filter ||
    r.event_type.includes(filter) ||
    (r.reason || "").includes(filter) ||
    (r.customer_id || "").includes(filter) ||
    (r.merchant_id || "").includes(filter)
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="w-5 h-5 text-primary" />
          <h1 className="font-cairo font-bold text-2xl text-foreground">سجل تدقيق عمليات QR</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="بحث بالحدث/السبب/المعرّف"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64 font-cairo"
          />
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button size="sm" variant="outline" onClick={exportAudit} disabled={!filtered.length} className="gap-1 font-cairo">
            <Download className="w-4 h-4" /> تصدير السجل
          </Button>
          <Button size="sm" variant="outline" onClick={exportSettlements} className="gap-1 font-cairo">
            <Download className="w-4 h-4" /> تصدير التسويات
          </Button>
        </div>
      </div>

      <Card className="p-2">
        <ScrollArea className="h-[65vh]">
          <table className="w-full text-sm">
            <thead className="text-right text-muted-foreground font-cairo">
              <tr className="border-b">
                <th className="p-3">الحدث</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">السبب</th>
                <th className="p-3">العميل</th>
                <th className="p-3">التاجر</th>
                <th className="p-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="p-3">
                    <Badge className={`${eventColor[r.event_type] || "bg-muted text-foreground"} font-cairo`}>
                      {eventLabel[r.event_type] || r.event_type}
                    </Badge>
                  </td>
                  <td className="p-3 font-ibm">{r.amount ? `${Number(r.amount).toFixed(2)} ر.س` : "—"}</td>
                  <td className="p-3 font-cairo max-w-xs truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.customer_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.merchant_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3 font-ibm text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-SA")}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground font-cairo">لا توجد سجلات</td></tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default AdminQRAudit;
