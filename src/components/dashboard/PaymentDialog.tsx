import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

interface PaymentDialogProps {
  customerId: string;
  owedAmount: number;
  onSuccess: () => void;
}

const PaymentDialog = ({ customerId, owedAmount, onSuccess }: PaymentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mada");
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("أدخل مبلغاً صالحاً");
      return;
    }
    if (numAmount > owedAmount) {
      toast.error("المبلغ أكبر من المستحق");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("make_payment", {
        p_customer_id: customerId,
        p_amount: numAmount,
        p_payment_method: method,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("تم السداد بنجاح! ✅");
      setOpen(false);
      setAmount("");
      onSuccess();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full bg-gradient-primary text-primary-foreground font-bold rounded-xl py-6 glow-green"
          disabled={owedAmount <= 0}
        >
          <CreditCard className="w-5 h-5 ml-2" />
          {owedAmount > 0 ? "سداد المستحقات" : "لا توجد مستحقات"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">سداد المستحقات</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground font-ibm">المبلغ المستحق</p>
            <p className="text-3xl font-cairo font-bold text-destructive">{owedAmount} ر.س</p>
          </div>

          <div>
            <Label className="font-cairo">المبلغ المراد سداده</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              dir="ltr"
              className="mt-1 text-center text-2xl font-bold"
              max={owedAmount}
              min="0.01"
              step="0.01"
            />
          </div>

          <div>
            <Label className="font-cairo">طريقة الدفع</Label>
            <div className="flex gap-2 mt-2">
              {[
                { id: "mada", label: "مدى" },
                { id: "apple_pay", label: "Apple Pay" },
              ].map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant={method === m.id ? "default" : "outline"}
                  className={`flex-1 ${method === m.id ? "bg-gradient-primary text-primary-foreground" : ""}`}
                  onClick={() => setMethod(m.id)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-gradient-primary text-primary-foreground font-bold py-6 rounded-xl"
          >
            {loading ? "جارٍ المعالجة..." : "تأكيد السداد"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
