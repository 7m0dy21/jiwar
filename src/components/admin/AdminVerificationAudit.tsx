import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ShieldCheck, Download, FileText, ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

interface CustomerJourney {
  id: string;
  user_id: string;
  created_at: string;
  is_verified: boolean;
  nafath_verified: boolean;
  nafith_signed: boolean;
  onboarding_completed: boolean;
  available_balance: number;
  credit_limit: number;
  simah_score: number | null;
}

const providerLabel: Record<string, string> = {
  nafath: "نفاذ",
  simah: "سمة",
  nafith: "نافذ",
};

const FILTER_KEY = "jiwar.verificationAudit.filters.v1";

interface Filters {
  q: string;
  source: string;
  outcome: string;
  provider: string;
  status: string;
  from: string;
  to: string;
}

const emptyFilters: Filters = {
  q: "", source: "all", outcome: "all", provider: "all", status: "all", from: "", to: "",
};

const AdminVerificationAudit = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Record<string, CustomerJourney | null>>({});
  const [journeyRows, setJourneyRows] = useState<Record<string, Row[]>>({});

  // Load saved filters on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) setFilters({ ...emptyFilters, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("verification_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
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

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const fromTs = filters.from ? new Date(filters.from).getTime() : null;
    const toTs = filters.to ? new Date(filters.to).getTime() + 24 * 3600 * 1000 : null;
    return rows.filter((r) => {
      if (filters.source !== "all" && (r.source || "") !== filters.source) return false;
      if (filters.outcome !== "all" && r.outcome !== filters.outcome) return false;
      if (filters.provider !== "all" && (r.provider || "") !== filters.provider) return false;
      if (filters.status !== "all" && (r.new_status || "") !== filters.status) return false;
      const t = new Date(r.created_at).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      if (q) {
        const hay = [r.provider, r.action, r.outcome, r.reason, r.customer_id, r.source, r.actor_role]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const saveFilters = () => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    toast.success("تم حفظ إعدادات البحث");
  };
  const resetFilters = () => {
    setFilters(emptyFilters);
    localStorage.removeItem(FILTER_KEY);
    toast.info("تمت إعادة ضبط الفلاتر");
  };

  const buildRows = () => filtered.map((r) => ({
    date: new Date(r.created_at).toLocaleString("ar-SA"),
    outcome: r.outcome,
    action: r.action,
    provider: providerLabel[r.provider || ""] || r.provider || "",
    status: `${r.old_status || ""}${r.old_status ? " → " : ""}${r.new_status || ""}`,
    source: r.source || "",
    actor_role: r.actor_role,
    customer_id: r.customer_id || "",
    reason: r.reason || "",
  }));

  const exportCSV = () => {
    const data = buildRows();
    if (!data.length) return toast.error("لا توجد سجلات للتصدير");
    const header = ["التاريخ","النتيجة","العملية","المزود","الحالة","المصدر","الدور","العميل","السبب"];
    const csv = [
      "\uFEFF" + header.join(","),
      ...data.map((r) => [r.date, r.outcome, r.action, r.provider, r.status, r.source, r.actor_role, r.customer_id, r.reason]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `verification-audit-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير CSV");
  };

  const exportPDF = () => {
    const data = buildRows();
    if (!data.length) return toast.error("لا توجد سجلات للتصدير");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Verification Audit Log - Jiwar", 14, 14);
    doc.setFontSize(9);
    doc.text(`Exported: ${new Date().toLocaleString()} | Rows: ${data.length}`, 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [["Date","Outcome","Action","Provider","Status","Source","Role","Customer","Reason"]],
      body: data.map((r) => [r.date, r.outcome, r.action, r.provider, r.status, r.source, r.actor_role, r.customer_id.slice(0,8), r.reason]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 58, 138] },
    });
    doc.save(`verification-audit-${Date.now()}.pdf`);
    toast.success("تم تصدير PDF");
  };

  const toggleExpand = async (r: Row) => {
    if (expanded === r.id) { setExpanded(null); return; }
    setExpanded(r.id);
    if (!r.customer_id) return;
    if (!journeys[r.customer_id]) {
      const { data } = await (supabase as any)
        .from("customers")
        .select("id,user_id,created_at,is_verified,nafath_verified,nafith_signed,onboarding_completed,available_balance,credit_limit,simah_score")
        .eq("id", r.customer_id)
        .maybeSingle();
      setJourneys((j) => ({ ...j, [r.customer_id!]: (data as CustomerJourney) || null }));
    }
    if (!journeyRows[r.customer_id]) {
      const { data } = await (supabase as any)
        .from("verification_audit_log")
        .select("*")
        .eq("customer_id", r.customer_id)
        .order("created_at", { ascending: true });
      setJourneyRows((j) => ({ ...j, [r.customer_id!]: (data as Row[]) || [] }));
    }
  };

  const uniqueValues = (key: keyof Row) =>
    Array.from(new Set(rows.map((r) => (r[key] as string) || "").filter(Boolean)));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="font-cairo font-bold text-2xl text-foreground">تدقيق توثيق العملاء</h1>
          <Badge variant="outline" className="font-cairo">{filtered.length} / {rows.length}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1 font-cairo">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1 font-cairo">
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Input
          placeholder="بحث حر"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          className="font-cairo col-span-2"
        />
        <Select value={filters.source} onValueChange={(v) => set({ source: v })}>
          <SelectTrigger className="font-cairo"><SelectValue placeholder="المصدر" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المصادر</SelectItem>
            <SelectItem value="edge_function">خادم (Service Role)</SelectItem>
            <SelectItem value="client">عميل</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.outcome} onValueChange={(v) => set({ outcome: v })}>
          <SelectTrigger className="font-cairo"><SelectValue placeholder="النتيجة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل النتائج</SelectItem>
            <SelectItem value="success">نجاح</SelectItem>
            <SelectItem value="failure">فشل</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.provider} onValueChange={(v) => set({ provider: v })}>
          <SelectTrigger className="font-cairo"><SelectValue placeholder="المزود" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المزودين</SelectItem>
            {["nafath","simah","nafith"].map((p) => (
              <SelectItem key={p} value={p}>{providerLabel[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger className="font-cairo"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {uniqueValues("new_status").map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="font-cairo" />
        </div>
        <div className="flex gap-1">
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="font-cairo" />
        </div>
        <div className="flex gap-2 col-span-2 md:col-span-4 lg:col-span-7 justify-end">
          <Button size="sm" variant="outline" onClick={saveFilters} className="gap-1 font-cairo">
            <Save className="w-4 h-4" /> حفظ إعدادات البحث
          </Button>
          <Button size="sm" variant="ghost" onClick={resetFilters} className="gap-1 font-cairo text-destructive">
            <Trash2 className="w-4 h-4" /> إعادة ضبط
          </Button>
        </div>
      </Card>

      <Card className="p-2">
        <ScrollArea className="h-[55vh]">
          <table className="w-full text-sm">
            <thead className="text-right text-muted-foreground font-cairo">
              <tr className="border-b">
                <th className="p-3 w-8"></th>
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
              {filtered.map((r) => {
                const j = r.customer_id ? journeys[r.customer_id] : null;
                const jr = r.customer_id ? journeyRows[r.customer_id] : null;
                const isOpen = expanded === r.id;
                return (
                  <>
                    <tr key={r.id} className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => toggleExpand(r)}>
                      <td className="p-3">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
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
                          {r.source === "edge_function" ? "خادم" : r.source === "client" ? "عميل" : r.source || "—"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{r.actor_role}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{r.customer_id?.slice(0, 8) || "—"}</td>
                      <td className="p-3 font-cairo max-w-xs truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                      <td className="p-3 font-ibm text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={10} className="p-4">
                          <div className="space-y-3">
                            <h3 className="font-cairo font-bold text-primary">رحلة العميل</h3>
                            {j ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-cairo">
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">تاريخ إنشاء الحساب</div>
                                  <div className="font-bold">{new Date(j.created_at).toLocaleString("ar-SA")}</div>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">حالة التوثيق</div>
                                  <Badge className={j.is_verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                    {j.is_verified ? "موثّق" : "غير موثّق"}
                                  </Badge>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">اكتمال التسجيل</div>
                                  <Badge variant="outline">{j.onboarding_completed ? "مكتمل" : "غير مكتمل"}</Badge>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">درجة سمة</div>
                                  <div className="font-bold">{j.simah_score ?? "—"}</div>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">حد الائتمان</div>
                                  <div className="font-bold text-primary">{j.credit_limit} ر.س</div>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">الرصيد المتاح</div>
                                  <div className="font-bold text-emerald-600">{j.available_balance} ر.س</div>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">نفاذ</div>
                                  <Badge className={j.nafath_verified ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                                    {j.nafath_verified ? "تم" : "لم يتم"}
                                  </Badge>
                                </div>
                                <div className="p-2 rounded bg-background border">
                                  <div className="text-muted-foreground">نافذ</div>
                                  <Badge className={j.nafith_signed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                                    {j.nafith_signed ? "تم توقيع السند" : "لم يوقّع"}
                                  </Badge>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground font-cairo">جاري تحميل بيانات العميل…</div>
                            )}

                            <div>
                              <div className="text-xs font-cairo text-muted-foreground mb-2">الخط الزمني لأحداث التوثيق</div>
                              <div className="space-y-1">
                                {(jr || []).map((e) => (
                                  <div key={e.id} className="flex items-center gap-2 text-xs font-cairo">
                                    <span className={`w-2 h-2 rounded-full ${e.outcome === "success" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("ar-SA")}</span>
                                    <span>·</span>
                                    <span>{providerLabel[e.provider || ""] || e.provider || "—"}</span>
                                    <span>·</span>
                                    <span>{e.new_status || "—"}</span>
                                    {e.reason && <span className="text-muted-foreground">— {e.reason}</span>}
                                  </div>
                                ))}
                                {j && (
                                  <div className="flex items-center gap-2 text-xs font-cairo pt-1 border-t mt-2">
                                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                                    <span className="text-muted-foreground">{new Date(j.created_at).toLocaleString("ar-SA")}</span>
                                    <span>·</span>
                                    <span className="font-bold text-primary">تفعيل الرصيد: {j.available_balance} / {j.credit_limit} ر.س</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground font-cairo">لا توجد سجلات</td></tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default AdminVerificationAudit;
