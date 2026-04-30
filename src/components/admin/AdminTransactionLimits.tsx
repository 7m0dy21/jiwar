import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

type Entity = { id: string; name: string };
type Limits = { per_transaction_limit: number; daily_limit: number; monthly_limit: number };

const DEFAULTS: Limits = { per_transaction_limit: 1000, daily_limit: 3000, monthly_limit: 20000 };

const AdminTransactionLimits = () => {
  const [customers, setCustomers] = useState<Entity[]>([]);
  const [merchants, setMerchants] = useState<Entity[]>([]);
  const [limitsMap, setLimitsMap] = useState<Record<string, Limits>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [c, m, l] = await Promise.all([
      supabase.from("customers").select("id, user_id"),
      supabase.from("merchants").select("id, store_name"),
      supabase.from("transaction_limits").select("*"),
    ]);
    const userIds = (c.data || []).map((x) => x.user_id);
    const profiles = userIds.length
      ? (await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)).data || []
      : [];
    const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
    setCustomers((c.data || []).map((x: any) => ({ id: x.id, name: profileMap.get(x.user_id) || x.id.slice(0, 8) })));
    setMerchants((m.data || []).map((x: any) => ({ id: x.id, name: x.store_name || x.id.slice(0, 8) })));
    const map: Record<string, Limits> = {};
    (l.data || []).forEach((row: any) => {
      map[`${row.entity_type}:${row.entity_id}`] = {
        per_transaction_limit: Number(row.per_transaction_limit),
        daily_limit: Number(row.daily_limit),
        monthly_limit: Number(row.monthly_limit),
      };
    });
    setLimitsMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getLimits = (key: string): Limits => limitsMap[key] || DEFAULTS;

  const update = (key: string, field: keyof Limits, value: string) => {
    const num = Number(value) || 0;
    setLimitsMap((m) => ({ ...m, [key]: { ...getLimits(key), [field]: num } }));
  };

  const save = async (entity_type: "customer" | "merchant", entity_id: string) => {
    const key = `${entity_type}:${entity_id}`;
    const lim = getLimits(key);
    setSavingId(key);
    const { error } = await supabase.from("transaction_limits").upsert({
      entity_type, entity_id, ...lim,
    }, { onConflict: "entity_type,entity_id" });
    setSavingId("");
    if (error) toast.error(error.message);
    else toast.success("تم حفظ الحدود");
  };

  const renderRow = (entity_type: "customer" | "merchant", e: Entity) => {
    const key = `${entity_type}:${e.id}`;
    const lim = getLimits(key);
    return (
      <div key={e.id} className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-cairo font-bold text-foreground">{e.name}</p>
          <Button size="sm" onClick={() => save(entity_type, e.id)} disabled={savingId === key}
            className="bg-gradient-primary text-primary-foreground gap-1">
            <Save className="w-3 h-3" />
            {savingId === key ? "..." : "حفظ"}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs font-cairo">لكل عملية</Label>
            <Input type="number" value={lim.per_transaction_limit} onChange={(ev) => update(key, "per_transaction_limit", ev.target.value)} dir="ltr" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-cairo">يومي</Label>
            <Input type="number" value={lim.daily_limit} onChange={(ev) => update(key, "daily_limit", ev.target.value)} dir="ltr" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-cairo">شهري</Label>
            <Input type="number" value={lim.monthly_limit} onChange={(ev) => update(key, "monthly_limit", ev.target.value)} dir="ltr" className="mt-1" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="w-5 h-5 text-primary" />
        <h2 className="font-cairo font-bold text-foreground text-lg">إعدادات حدود العمليات</h2>
      </div>
      <p className="text-xs text-muted-foreground font-ibm mb-4">
        القيم الافتراضية: 1000 لكل عملية، 3000 يومياً، 20000 شهرياً (بالريال السعودي)
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground font-ibm">جارٍ التحميل...</p>
      ) : (
        <Tabs defaultValue="customers">
          <TabsList className="mb-4">
            <TabsTrigger value="customers" className="font-cairo">العملاء ({customers.length})</TabsTrigger>
            <TabsTrigger value="merchants" className="font-cairo">التجار ({merchants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="customers" className="space-y-3 max-h-[60vh] overflow-y-auto">
            {customers.map((c) => renderRow("customer", c))}
          </TabsContent>
          <TabsContent value="merchants" className="space-y-3 max-h-[60vh] overflow-y-auto">
            {merchants.map((m) => renderRow("merchant", m))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AdminTransactionLimits;
