import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, ArrowLeftRight, Wallet, ShieldCheck, Clock } from "lucide-react";

interface Kpis {
  customers: number;
  verifiedCustomers: number;
  merchants: number;
  verifiedMerchants: number;
  transactions: number;
  volume: number;
  pending: number;
}

const AdminOverview = () => {
  const [k, setK] = useState<Kpis>({
    customers: 0, verifiedCustomers: 0, merchants: 0, verifiedMerchants: 0,
    transactions: 0, volume: 0, pending: 0,
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(getDb(), "customers"), (s) => {
        setK((p) => ({
          ...p,
          customers: s.size,
          verifiedCustomers: s.docs.filter((d) => (d.data() as any).is_verified === true).length,
        }));
      }),
      onSnapshot(collection(getDb(), "merchants"), (s) => {
        setK((p) => ({
          ...p,
          merchants: s.size,
          verifiedMerchants: s.docs.filter((d) => (d.data() as any).is_verified === true).length,
        }));
      }),
      onSnapshot(collection(getDb(), "transactions"), (s) => {
        let volume = 0, pending = 0;
        s.docs.forEach((d) => {
          const x = d.data() as any;
          if (x.status === "completed") volume += Number(x.amount) || 0;
          if (x.status === "pending") pending += 1;
        });
        setK((p) => ({ ...p, transactions: s.size, volume, pending }));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const cards = [
    { label: "إجمالي العملاء", value: k.customers, sub: `${k.verifiedCustomers} موثّق`, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "إجمالي التجار", value: k.merchants, sub: `${k.verifiedMerchants} موثّق`, icon: Store, color: "text-emerald-600 bg-emerald-50" },
    { label: "المعاملات", value: k.transactions, sub: `${k.pending} قيد الانتظار`, icon: ArrowLeftRight, color: "text-purple-600 bg-purple-50" },
    { label: "حجم التداول", value: `${k.volume.toFixed(2)} ر.س`, sub: "معاملات مكتملة", icon: Wallet, color: "text-primary bg-primary/10" },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">لوحة المؤشرات</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-cairo">{c.label}</p>
                    <p className="text-2xl font-bold mt-2 font-cairo" dir="ltr">{c.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-cairo">{c.sub}</p>
                  </div>
                  <div className={`rounded-xl p-2 ${c.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" /> نسبة التوثيق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              العملاء الموثّقون:{" "}
              <span className="font-bold text-foreground">
                {k.customers ? Math.round((k.verifiedCustomers / k.customers) * 100) : 0}%
              </span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              التجار الموثّقون:{" "}
              <span className="font-bold text-foreground">
                {k.merchants ? Math.round((k.verifiedMerchants / k.merchants) * 100) : 0}%
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-amber-600" /> نشاط اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              معاملات قيد الانتظار: <span className="font-bold text-foreground">{k.pending}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              متوسط قيمة المعاملة:{" "}
              <span className="font-bold text-foreground" dir="ltr">
                {k.transactions ? (k.volume / k.transactions).toFixed(2) : "0.00"} ر.س
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
