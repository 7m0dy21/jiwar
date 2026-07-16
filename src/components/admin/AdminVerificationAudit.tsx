import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Row {
  id: string;
  verification_id: string | null;
  customer_id: string | null;
  provider: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  outcome: string;
  actor_role: string;
  actor_user_id: string | null;
  source: string | null;
  reason: string | null;
  details: any;
  created_at: string;
}

const providerLabel: Record<string, string> = {
  nafath: "نفاذ",
  simah: "سمة",
  nafith: "نافذ",
};

const AdminVerificationAudit = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("verification_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-verification-audit")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "verification_audit_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = rows.filter((r) =>
    !filter ||
    (r.provider || "").includes(filter) ||
    r.action.includes(filter) ||
    r.outcome.includes(filter) ||
    (r.reason || "").includes(filter) ||
    (r.customer_id || "").includes(filter) ||
    (r.source || "").includes(filter)
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="font-cairo font-bold text-2xl text-foreground">تدقيق توثيق العملاء</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="بحث بالمزود/المصدر/السبب/العميل"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64 font-cairo"
          />
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </div>
      </div>

      <Card className="p-2">
        <ScrollArea className="h-[65vh]">
          <table className="w-full text-sm">
            <thead className="text-right text-muted-foreground font-cairo">
              <tr className="border-b">
                <th className="p-3">النتيجة</th>
                <th className="p-3">العملية</th>
                <th className="p-3">المزود</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">المصدر</th>
                <th className="p-3">الدور</th>
                <th className="p-3">العميل</th>
                <th className="p-3">السبب</th>
                <th className="p-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="p-3">
                    <Badge className={`font-cairo ${r.outcome === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {r.outcome === "success" ? "نجاح" : "فشل"}
                    </Badge>
                  </td>
                  <td className="p-3 font-cairo">{r.action === "insert" ? "إنشاء" : "تحديث"}</td>
                  <td className="p-3 font-cairo">{providerLabel[r.provider || ""] || r.provider || "—"}</td>
                  <td className="p-3 font-cairo text-xs">
                    {r.old_status ? `${r.old_status} → ` : ""}{r.new_status || "—"}
                  </td>
                  <td className="p-3 font-cairo text-xs">
                    <Badge variant="outline" className="font-cairo">
                      {r.source === "edge_function" ? "خادم (Service Role)" : r.source === "client" ? "عميل" : r.source || "—"}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.actor_role}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.customer_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3 font-cairo max-w-xs truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                  <td className="p-3 font-ibm text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-SA")}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground font-cairo">لا توجد سجلات</td></tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default AdminVerificationAudit;
