import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  description: string | null;
}

interface TransactionListProps {
  userId: string;
  role: "merchant" | "customer";
  refreshKey?: number;
}

const TransactionList = ({ userId, role, refreshKey }: TransactionListProps) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Get the entity id first
      const table = role === "merchant" ? "merchants" : "customers";
      const { data: entity } = await supabase
        .from(table)
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!entity) { setLoading(false); return; }

      const col = role === "merchant" ? "merchant_id" : "customer_id";
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq(col, entity.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setTransactions(data || []);
      setLoading(false);
    };
    load();
  }, [userId, role, refreshKey]);

  if (loading) return <p className="text-muted-foreground text-center py-4 font-ibm">جارٍ تحميل العمليات...</p>;

  if (transactions.length === 0) {
    return <p className="text-muted-foreground text-center py-8 font-ibm">لا توجد عمليات حتى الآن</p>;
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
          <div>
            <p className="font-cairo font-bold text-foreground text-sm">
              {tx.status === "completed" ? "✅" : "⏳"} عملية شراء
            </p>
            <p className="text-xs text-muted-foreground font-ibm">
              {format(new Date(tx.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
            </p>
          </div>
          <p className={`font-cairo font-bold ${role === "merchant" ? "text-primary" : "text-destructive"}`}>
            {role === "merchant" ? "+" : "-"}{tx.amount} ر.س
          </p>
        </div>
      ))}
    </div>
  );
};

export default TransactionList;
