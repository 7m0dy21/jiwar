import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

interface RoleAuditRow {
  id: string;
  correlation_id: string;
  user_id: string | null;
  decision: "success" | "empty" | "error" | "retry_success";
  resolved_role: string | null;
  reason: string | null;
  code: string | null;
  attempts: number;
  latency_ms: number | null;
  route: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const decisionColor = (d: RoleAuditRow["decision"]) => {
  switch (d) {
    case "success": return "default" as const;
    case "retry_success": return "secondary" as const;
    case "empty": return "outline" as const;
    case "error": return "destructive" as const;
  }
};

const AdminRoleAudit = () => {
  const [rows, setRows] = useState<RoleAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const client = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: RoleAuditRow[] | null; error: { message: string } | null }> & {
              eq: (c: string, v: string) => Promise<{ data: RoleAuditRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
    let q = client.from("role_check_audit").select("*").order("created_at", { ascending: false }).limit(200);
    if (decisionFilter !== "all") {
      // @ts-expect-error dynamic filter
      q = q.eq("decision", decisionFilter);
    }
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error("تعذر تحميل السجل"); return; }
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [decisionFilter]);

  const total = rows.length;
  const errors = rows.filter((r) => r.decision === "error").length;
  const empty = rows.filter((r) => r.decision === "empty").length;
  const retries = rows.filter((r) => r.decision === "retry_success").length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-cairo font-bold text-foreground">تدقيق قرارات الصلاحيات</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background font-ibm"
          >
            <option value="all">كل القرارات</option>
            <option value="success">نجاح</option>
            <option value="retry_success">نجاح بعد إعادة</option>
            <option value="empty">بدون دور</option>
            <option value="error">فشل</option>
          </select>
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "الإجمالي", val: total },
          { label: "فشل", val: errors },
          { label: "بدون دور", val: empty },
          { label: "نجاح بعد إعادة", val: retries },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="text-xs text-muted-foreground font-ibm">{s.label}</div>
            <div className="text-2xl font-cairo font-bold text-foreground">{s.val}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground font-ibm">
          لا توجد قرارات مسجّلة بعد.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-card border border-border rounded-2xl p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={decisionColor(row.decision)} className="font-cairo">
                      {row.decision}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">{row.correlation_id}</span>
                    {row.resolved_role && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-mono text-foreground">role: {row.resolved_role}</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-ibm text-foreground">محاولات: {row.attempts}</span>
                    {row.latency_ms !== null && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-ibm text-foreground">{row.latency_ms}ms</span>
                      </>
                    )}
                    {row.code && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-mono text-destructive">{row.code}</span>
                      </>
                    )}
                  </div>
                  {row.reason && (
                    <p className="text-sm text-foreground font-ibm break-words">{row.reason}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-ibm">
                    <span>{new Date(row.created_at).toLocaleString("ar-SA")}</span>
                    {row.route && <span>· {row.route}</span>}
                    {row.user_id && <span>· user: {row.user_id.slice(0, 8)}…</span>}
                  </div>
                  {row.details && (
                    <pre className="mt-2 text-[11px] bg-muted p-2 rounded-lg overflow-x-auto font-mono text-foreground/80">
{JSON.stringify(row.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRoleAudit;
