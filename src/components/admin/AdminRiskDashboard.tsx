import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface RiskScore {
  id: string;
  merchant_id: string;
  score: number;
  level: "low" | "medium" | "high";
  reason: string | null;
  total_transactions: number;
  total_volume: number;
  failed_count: number;
  updated_at: string;
}

interface Alert {
  id: string;
  merchant_id: string;
  level: "info" | "warning" | "critical";
  message: string;
  resolved: boolean;
  created_at: string;
}

const AdminRiskDashboard = () => {
  const [scores, setScores] = useState<(RiskScore & { store_name?: string })[]>([]);
  const [alerts, setAlerts] = useState<(Alert & { store_name?: string })[]>([]);

  const load = async () => {
    const { data: s } = await supabase
      .from("merchant_risk_scores")
      .select("*")
      .order("score", { ascending: false });
    const { data: a } = await supabase
      .from("merchant_risk_alerts")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(20);

    const merchantIds = Array.from(new Set([...(s || []).map((x) => x.merchant_id), ...(a || []).map((x) => x.merchant_id)]));
    const { data: merchants } = await supabase
      .from("merchants").select("id, store_name").in("id", merchantIds.length ? merchantIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((merchants || []).map((m) => [m.id, m.store_name]));

    setScores((s || []).map((x: any) => ({ ...x, store_name: map.get(x.merchant_id) })));
    setAlerts((a || []).map((x: any) => ({ ...x, store_name: map.get(x.merchant_id) })));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("risk-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_risk_alerts" }, (p: any) => {
        load();
        if (p.eventType === "INSERT" && p.new?.level === "critical") {
          toast.error("⚠️ تنبيه مخاطر حرج: " + p.new.message);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_risk_scores" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const levelColor = (l: string) =>
    l === "high" || l === "critical" ? "destructive" : l === "medium" || l === "warning" ? "secondary" : "default";
  const levelLabel = (l: string) =>
    ({ low: "منخفض", medium: "متوسط", high: "عالي", info: "معلومة", warning: "تحذير", critical: "حرج" } as any)[l] || l;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-cairo font-bold">تقييم مخاطر التجار</h2>
      </div>

      {alerts.length > 0 && (
        <Card className="p-6 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-cairo font-bold text-lg">تنبيهات لحظية ({alerts.length})</h3>
          </div>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                <div>
                  <p className="font-cairo font-bold text-foreground">{a.store_name || a.merchant_id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground font-ibm">{a.message}</p>
                  <p className="text-xs text-muted-foreground font-ibm mt-1">{new Date(a.created_at).toLocaleString("ar-SA")}</p>
                </div>
                <Badge variant={levelColor(a.level) as any} className="font-cairo">{levelLabel(a.level)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-cairo font-bold text-lg">تقييمات التجار</h3>
        </div>
        {scores.length === 0 ? (
          <p className="text-center text-muted-foreground font-ibm py-8">لا يوجد بيانات بعد</p>
        ) : (
          <div className="space-y-3">
            {scores.map((s) => (
              <div key={s.id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-cairo font-bold text-foreground">{s.store_name || s.merchant_id.slice(0, 8)}</p>
                  <Badge variant={levelColor(s.level) as any} className="font-cairo">{levelLabel(s.level)} ({s.score})</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground font-ibm">العمليات:</span> <span className="font-bold">{s.total_transactions}</span></div>
                  <div><span className="text-muted-foreground font-ibm">الحجم:</span> <span className="font-bold">{Number(s.total_volume).toFixed(0)} ر.س</span></div>
                  <div><span className="text-muted-foreground font-ibm">الفشل:</span> <span className="font-bold">{s.failed_count}</span></div>
                </div>
                {s.reason && <p className="text-xs text-muted-foreground font-ibm mt-2">{s.reason}</p>}
                <div className="w-full bg-muted rounded-full h-1.5 mt-3">
                  <div
                    className={`h-1.5 rounded-full ${s.level === "high" ? "bg-destructive" : s.level === "medium" ? "bg-jiwar-gold" : "bg-primary"}`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminRiskDashboard;
