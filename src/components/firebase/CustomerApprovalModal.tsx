import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  respondToTransaction,
  subscribePendingForCustomer,
  type TransactionRecord,
} from "@/lib/firebaseTransactions";

interface Props {
  customerUid: string;
}

const CustomerApprovalModal = ({ customerUid }: Props) => {
  const [pending, setPending] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerUid) return;
    return subscribePendingForCustomer(customerUid, setPending);
  }, [customerUid]);

  // Show the oldest pending first, one at a time.
  const current = [...pending].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))[0];

  const respond = async (approve: boolean) => {
    if (!current) return;
    setLoading(true);
    try {
      await respondToTransaction(current.id, approve);
      toast.success(approve ? "تمت الموافقة على الدفع" : "تم رفض الطلب");
    } catch (e: any) {
      toast.error(e?.message || "فشل الرد");
    } finally {
      setLoading(false);
    }
  };

  if (!current) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) respond(false); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="font-bold text-xl">طلب دفع جديد</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-muted rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">التاجر</p>
            <p className="font-bold text-lg mb-4" dir="ltr">{current.merchant_id}</p>
            <p className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</p>
            <p className="font-bold text-primary text-4xl">
              {current.amount.toFixed(2)} <span className="text-lg">ر.س</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">راجع المبلغ قبل الموافقة</p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => respond(false)} disabled={loading} variant="outline" className="gap-2 border-destructive/40 text-destructive">
              <X className="w-4 h-4" /> رفض
            </Button>
            <Button onClick={() => respond(true)} disabled={loading} className="gap-2">
              <Check className="w-4 h-4" /> موافقة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerApprovalModal;
