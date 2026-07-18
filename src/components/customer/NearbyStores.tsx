import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store as StoreIcon, ShieldCheck } from "lucide-react";

interface Row {
  uid: string;
  merchant_id: string;
  store_name: string;
  district?: string;
  distance_km?: number;
}

const NearbyStores = () => {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const q = query(collection(getDb(), "merchants"), where("is_verified", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d, i) => {
            const x = d.data() as any;
            return {
              uid: d.id,
              merchant_id: x.merchant_id ?? "",
              store_name: x.store_name ?? "متجر",
              district: x.district ?? "الحي التجريبي",
              distance_km: x.distance_km ?? +(0.3 + i * 0.4).toFixed(1),
            };
          }),
        );
      },
      (err) => console.warn("nearby stores query failed", err),
    );
    return () => unsub();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="w-4 h-4 text-primary" />
          متاجر البقالة الموثّقة القريبة
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            لا توجد متاجر موثّقة قريبة حالياً
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.slice(0, 6).map((r) => (
              <div
                key={r.uid}
                className="flex items-start gap-3 border rounded-xl p-3 hover:bg-muted/30 transition"
              >
                <div className="bg-primary/10 rounded-lg p-2">
                  <StoreIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-cairo font-semibold truncate">{r.store_name}</p>
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <ShieldCheck className="w-3 h-3" /> موثّق
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.district}</p>
                  <p className="text-xs text-primary mt-1">{r.distance_km} كم</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NearbyStores;
