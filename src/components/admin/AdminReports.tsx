import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";

interface Tx {
  id: string;
  account_number: string;
  merchant_id: string;
  amount: number;
  status: string;
  created_at: number | null;
}

const AdminReports = () => {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [subject, setSubject] = useState<"customer" | "merchant">("customer");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const q = query(collection(getDb(), "transactions"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTxs(
        snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            account_number: x.account_number ?? "",
            merchant_id: x.merchant_id ?? "",
            amount: Number(x.amount) || 0,
            status: x.status ?? "pending",
            created_at: x.created_at?.toMillis?.() ?? null,
          };
        }),
      );
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!term.trim()) return [];
    if (subject === "customer") return txs.filter((t) => t.account_number.includes(term.trim()));
    return txs.filter((t) => t.merchant_id.toUpperCase().includes(term.trim().toUpperCase()));
  }, [txs, term, subject]);

  const summary = useMemo(() => {
    const completed = filtered.filter((t) => t.status === "completed");
    return {
      count: filtered.length,
      completedCount: completed.length,
      volume: completed.reduce((s, t) => s + t.amount, 0),
      pending: filtered.filter((t) => t.status === "pending").length,
      declined: filtered.filter((t) => t.status === "declined").length,
    };
  }, [filtered]);

  const download = () => {
    if (filtered.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const header = "id,account_number,merchant_id,amount,status,created_at\n";
    const rows = filtered
      .map(
        (t) =>
          `${t.id},${t.account_number},${t.merchant_id},${t.amount},${t.status},${
            t.created_at ? new Date(t.created_at).toISOString() : ""
          }`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${subject}-${term}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">التقارير</h1>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" /> إنشاء تقرير تفصيلي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={subject === "customer" ? "default" : "outline"}
              onClick={() => setSubject("customer")}
            >
              حسب العميل
            </Button>
            <Button
              size="sm"
              variant={subject === "merchant" ? "default" : "outline"}
              onClick={() => setSubject("merchant")}
            >
              حسب التاجر
            </Button>
          </div>
          <div>
            <Label>{subject === "customer" ? "رقم حساب العميل" : "معرف التاجر"}</Label>
            <Input
              dir="ltr"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={subject === "customer" ? "1000000001" : "M100000"}
            />
          </div>
          <Button onClick={download} className="gap-2" disabled={!filtered.length}>
            <Download className="w-4 h-4" /> تصدير CSV
          </Button>
        </CardContent>
      </Card>

      {term && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">إجمالي العمليات</p><p className="text-xl font-bold">{summary.count}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">المكتملة</p><p className="text-xl font-bold text-primary">{summary.completedCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">قيد الانتظار</p><p className="text-xl font-bold text-amber-600">{summary.pending}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">حجم التداول</p><p className="text-lg font-bold" dir="ltr">{summary.volume.toFixed(2)} ر.س</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                  <tr>
                    <th className="text-right p-3">المرجع</th>
                    <th className="text-right p-3">حساب</th>
                    <th className="text-right p-3">تاجر</th>
                    <th className="text-right p-3">مبلغ</th>
                    <th className="text-right p-3">حالة</th>
                    <th className="text-right p-3">تاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs" dir="ltr">{t.id.slice(0, 8)}</td>
                      <td className="p-3 font-mono" dir="ltr">{t.account_number}</td>
                      <td className="p-3 font-mono" dir="ltr">{t.merchant_id}</td>
                      <td className="p-3 font-bold" dir="ltr">{t.amount.toFixed(2)}</td>
                      <td className="p-3">
                        <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleString("ar-SA") : "—"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-muted-foreground">
                        لا توجد نتائج
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminReports;
