import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveTransactionAtomic,
  declineTransaction,
  InsufficientFundsError,
  subscribePendingForCustomer,
  type TransactionRecord,
} from "@/lib/firebaseTransactions";

interface Props {
  customerUid: string;
  walletBalance: number;
  isVerified: boolean;
}

const CustomerApprovalModal = ({ customerUid, walletBalance, isVerified }: Props) => {
  const [pending, setPending] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerUid) return;
    return subscribePendingForCustomer(customerUid, setPending);
  }, [customerUid]);

  const current = [...pending].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))[0];

  const approve = async () => {
    if (!current) return;
    if (walletBalance < current.amount) {
      toast.error("الرصيد غير كافٍ لإتمام العملية");
      return;
    }
    setLoading(true);
    try {
      await approveTransactionAtomic(current.id, customerUid);
      toast.success("تمت الموافقة على الدفع");
    } catch (e: any) {
      if (e instanceof InsufficientFundsError) toast.error("الرصيد غير كافٍ لإتمام العملية");
      else toast.error(e?.message || "فشل الرد");
    } finally {
      setLoading(false);
    }
  };

  const decline = async () => {
    if (!current) return;
    setLoading(true);
    try {
      await declineTransaction(current.id);
      toast.success("تم رفض الطلب");
    } catch (e: any) {
      toast.error(e?.message || "فشل الرد");
    } finally {
      setLoading(false);
    }
  };

  if (!current) return null;
  const insufficient = walletBalance < current.amount;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) decline(); }}>
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
          <div className="text-sm">
            <span className="text-muted-foreground">رصيدك الحالي: </span>
            <span className="font-semibold" dir="ltr">{walletBalance.toFixed(2)} ر.س</span>
          </div>
          {insufficient && (
            <p className="text-sm text-destructive font-semibold">الرصيد غير كافٍ لإتمام العملية</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={decline} disabled={loading} variant="outline" className="gap-2 border-destructive/40 text-destructive">
              <X className="w-4 h-4" /> رفض
            </Button>
            <Button onClick={approve} disabled={loading || insufficient} className="gap-2">
              <Check className="w-4 h-4" /> موافقة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerApprovalModal;
