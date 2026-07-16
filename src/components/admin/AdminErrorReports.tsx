import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ErrorLogRow {
  id: string;
  correlation_id: string;
  user_id: string | null;
  source: string;
  code: string | null;
  message: string;
  details: Record<string, unknown> | null;
  route: string | null;
  severity: string;
  created_at: string;
}

const severityColor = (s: string) => {
  switch (s) {
    case "critical": return "destructive" as const;
    case "error": return "destructive" as const;
    case "warning": return "secondary" as const;
    default: return "outline" as const;
  }
};

const AdminErrorReports = () => {
  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error("تعذر تحميل السجل"); return; }
    setRows((data || []) as ErrorLogRow[]);
  };

  useEffect(() => { load(); }, [sourceFilter]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("error_logs").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف"); return; }
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const sources = Array.from(new Set(rows.map((r) => r.source)));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h1 className="text-2xl font-cairo font-bold text-foreground">تقارير الأخطاء</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background font-ibm"
          >
            <option value="all">كل المصادر</option>
            {sources.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground font-ibm">
          لا توجد أخطاء مسجّلة.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-card border border-border rounded-2xl p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={severityColor(row.severity)} className="font-cairo">{row.severity}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">{row.correlation_id}</span>
                    <span className="text-xs text-muted-foreground font-ibm">·</span>
                    <span className="text-xs text-muted-foreground font-ibm">{row.source}</span>
                    {row.code && <><span className="text-xs text-muted-foreground">·</span><span className="text-xs font-mono text-foreground">{row.code}</span></>}
                  </div>
                  <p className="text-sm text-foreground font-ibm break-words">{row.message}</p>
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
                <Button variant="ghost" size="icon" onClick={() => remove(row.id)} title="حذف">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminErrorReports;
