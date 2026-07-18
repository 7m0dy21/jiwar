import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  subscribeMerchantSettlements,
  type SettlementRecord,
} from "@/lib/firebaseSettlements";

const statusBadge = (s: SettlementRecord["status"]) => {
  if (s === "completed")
    return <Badge className="bg-primary text-primary-foreground font-cairo">مكتملة</Badge>;
  if (s === "rejected")
    return <Badge variant="destructive" className="font-cairo">مرفوضة</Badge>;
  return <Badge className="bg-amber-500 text-white font-cairo">قيد المراجعة</Badge>;
};

const SettlementsLog = ({ merchantUid }: { merchantUid: string }) => {
  const [rows, setRows] = useState<SettlementRecord[]>([]);

  useEffect(() => {
    if (!merchantUid) return;
    return subscribeMerchantSettlements(merchantUid, setRows);
  }, [merchantUid]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>تسويات جوار للتاجر</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد تسويات بعد
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-right py-2">المرجع</th>
                  <th className="text-right py-2">المبلغ</th>
                  <th className="text-right py-2">الحالة</th>
                  <th className="text-right py-2">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 font-mono text-xs" dir="ltr">{r.reference}</td>
                    <td className="py-2 font-bold" dir="ltr">{r.amount.toFixed(2)} ر.س</td>
                    <td className="py-2">{statusBadge(r.status)}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("ar-SA") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettlementsLog;
