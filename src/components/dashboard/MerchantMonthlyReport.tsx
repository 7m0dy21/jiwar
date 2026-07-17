import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface Props { merchantId: string; merchantUserId: string; }

type ReqStatus = "pending" | "approved" | "rejected" | "expired" | "failed";

interface PaymentReq {
  id: string;
  amount: number;
  status: ReqStatus;
  created_at: string;
  reason: string | null;
  transaction_id: string | null;
}

interface Transfer { id: string; amount: number; status: string; created_at: string; }

const statusMeta: Record<ReqStatus, { label: string; cls: string; icon: any }> = {
  approved: { label: "مقبول", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  pending:  { label: "بانتظار الرد", cls: "bg-amber-100 text-amber-700", icon: Clock },
  rejected: { label: "مرفوض", cls: "bg-rose-100 text-rose-700", icon: XCircle },
  expired:  { label: "منتهي", cls: "bg-slate-200 text-slate-700", icon: AlertTriangle },
  failed:   { label: "فاشل", cls: "bg-red-100 text-red-700", icon: AlertTriangle },
};

const MerchantMonthlyReport = ({ merchantId, merchantUserId }: Props) => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [requests, setRequests] = useState<PaymentReq[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [month]);

  const load = async () => {
    setLoading(true);
    const [reqRes, trRes] = await Promise.all([
      supabase.from("payment_requests")
        .select("id, amount, status, created_at, reason, transaction_id")
        .eq("merchant_user_id", merchantUserId)
        .gte("created_at", range.start).lt("created_at", range.end)
        .order("created_at", { ascending: false }),
      supabase.from("merchant_transfers")
        .select("id, amount, status, created_at")
        .eq("merchant_id", merchantId)
        .gte("created_at", range.start).lt("created_at", range.end)
        .order("created_at", { ascending: false }),
    ]);
    setRequests((reqRes.data as PaymentReq[]) || []);
    setTransfers((trRes.data as Transfer[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (merchantId) load(); /* eslint-disable-next-line */ }, [merchantId, month]);

  const totals = useMemo(() => {
    const approvedAmt = requests.filter(r => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0);
    const pendingAmt  = requests.filter(r => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0);
    const failedAmt   = requests.filter(r => ["rejected","expired","failed"].includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);
    const transferredAmt = transfers.filter(t => t.status === "completed").reduce((s, t) => s + Number(t.amount), 0);
    const pendingTransfer = transfers.filter(t => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
    const outstanding = Math.max(0, approvedAmt - transferredAmt - pendingTransfer);
    return { approvedAmt, pendingAmt, failedAmt, transferredAmt, pendingTransfer, outstanding };
  }, [requests, transfers]);

  const exportRequestsCSV = () => {
    import("@/lib/csv").then(({ downloadCSV }) =>
      downloadCSV(
        `requests-${month}.csv`,
        ["التاريخ", "المبلغ", "الحالة", "السبب", "معرف المعاملة"],
        requests.map((r) => [
          new Date(r.created_at).toLocaleString("ar-SA"),
          Number(r.amount).toFixed(2),
          statusMeta[r.status]?.label || r.status,
          r.reason || "",
          r.transaction_id || "",
        ])
      )
    );
  };

  const exportTransfersCSV = () => {
    import("@/lib/csv").then(({ downloadCSV }) =>
      downloadCSV(
        `settlements-${month}.csv`,
        ["التاريخ", "معرف التحويل", "المبلغ", "الحالة"],
        transfers.map((t) => [
          new Date(t.created_at).toLocaleString("ar-SA"),
          t.id,
          Number(t.amount).toFixed(2),
          t.status,
        ])
      )
    );
  };

  const cards = [
    { icon: CheckCircle2, label: "مبيعات معتمدة", value: totals.approvedAmt, cls: "text-emerald-600" },
    { icon: TrendingUp,   label: "محوّل للحساب البنكي", value: totals.transferredAmt, cls: "text-primary" },
    { icon: Clock,        label: "تحويلات قيد المعالجة", value: totals.pendingTransfer, cls: "text-jiwar-gold" },
    { icon: AlertTriangle,label: "متبقٍ للتسوية", value: totals.outstanding, cls: "text-jiwar-blue" },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-cairo font-bold text-foreground text-lg">تقرير التسوية الشهرية</h2>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44 font-ibm" />
          <Button size="sm" variant="outline" onClick={exportRequestsCSV} disabled={!requests.length} className="font-cairo">
            تصدير الطلبات
          </Button>
          <Button size="sm" variant="outline" onClick={exportTransfersCSV} disabled={!transfers.length} className="font-cairo">
            تصدير التسويات
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <c.icon className={`w-4 h-4 ${c.cls}`} />
              <span className="text-xs font-ibm">{c.label}</span>
            </div>
            <p className={`text-lg font-cairo font-bold ${c.cls}`}>
              {loading ? "..." : `${c.value.toFixed(2)} ر.س`}
            </p>
          </div>
        ))}
      </div>

      {(totals.pendingAmt > 0 || totals.failedAmt > 0) && (
        <div className="grid grid-cols-2 gap-3 text-sm font-cairo">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            طلبات معلّقة: {totals.pendingAmt.toFixed(2)} ر.س
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
            طلبات فاشلة/مرفوضة: {totals.failedAmt.toFixed(2)} ر.س
          </div>
        </div>
      )}

      <Card className="p-2">
        <ScrollArea className="h-[45vh]">
          <table className="w-full text-sm">
            <thead className="text-right text-muted-foreground font-cairo">
              <tr className="border-b">
                <th className="p-3">التاريخ</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">السبب</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const meta = statusMeta[r.status] || { label: r.status, cls: "bg-muted text-foreground", icon: FileText };
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/40">
                    <td className="p-3 font-ibm text-xs">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                    <td className="p-3 font-ibm font-bold">{Number(r.amount).toFixed(2)} ر.س</td>
                    <td className="p-3">
                      <Badge className={`${meta.cls} font-cairo gap-1`}><Icon className="w-3 h-3" />{meta.label}</Badge>
                    </td>
                    <td className="p-3 font-cairo max-w-md truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                  </tr>
                );
              })}
              {!requests.length && !loading && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground font-cairo">لا توجد طلبات لهذا الشهر</td></tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default MerchantMonthlyReport;
