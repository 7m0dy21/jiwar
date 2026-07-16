import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface PaymentRequestRow {
  id: string;
  amount: number;
  merchant_user_id: string;
  merchant_id: string;
  status: string;
  expires_at: string;
  merchant_name?: string;
}

const PaymentApprovals = () => {
  const { user } = useAuth();
  const [request, setRequest] = useState<PaymentRequestRow | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payment_requests")
      .select("id, amount, merchant_user_id, merchant_id, status, expires_at")
      .eq("customer_user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("user_id", data.merchant_user_id).single();
      setRequest({ ...data, merchant_name: prof?.full_name || "التاجر" });
    }
  }, [user]);

  useEffect(() => {
    loadPending();
    if (!user) return;
    const ch = supabase
      .channel("customer-payment-requests")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_requests", filter: `customer_user_id=eq.${user.id}` },
        () => loadPending())
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_requests", filter: `customer_user_id=eq.${user.id}` },
        (payload: any) => {
          if (request && payload.new.id === request.id && payload.new.status !== "pending") {
            setRequest(null);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadPending, request]);

  const respond = async (approve: boolean) => {
    if (!request) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("respond_payment_request", {
      p_request_id: request.id, p_approve: approve,
    });
    setLoading(false);
    if (error) { toast.error(error.message || "فشل الرد"); return; }
    toast.success(approve ? "تمت الموافقة على الدفع" : "تم رفض الطلب");
    setRequest(null);
  };

  if (!request) return null;

  return (
    <Dialog open={!!request} onOpenChange={(v) => { if (!v) respond(false); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">طلب دفع جديد</DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="bg-muted rounded-xl p-6">
            <p className="text-sm text-muted-foreground font-ibm mb-1">التاجر</p>
            <p className="font-cairo font-bold text-foreground text-lg mb-4">{request.merchant_name}</p>
            <p className="text-sm text-muted-foreground font-ibm mb-1">المبلغ المطلوب خصمه</p>
            <p className="font-cairo font-bold text-primary text-4xl">{Number(request.amount).toFixed(2)} <span className="text-lg">ر.س</span></p>
          </div>
          <p className="text-xs text-muted-foreground font-ibm">راجع المبلغ قبل الموافقة - سيتم الخصم فوراً</p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => respond(false)} disabled={loading} variant="outline" className="border-destructive/40 text-destructive font-cairo gap-2">
              <X className="w-4 h-4" /> رفض
            </Button>
            <Button onClick={() => respond(true)} disabled={loading} className="bg-gradient-primary text-primary-foreground font-cairo gap-2">
              <Check className="w-4 h-4" /> موافقة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentApprovals;
