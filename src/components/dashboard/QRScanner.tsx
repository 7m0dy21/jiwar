import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

interface QRScannerProps {
  merchantId: string;
  onSuccess: () => void;
}

const QRScanner = ({ merchantId, onSuccess }: QRScannerProps) => {
  const [open, setOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [step, setStep] = useState<"scan" | "confirm">("scan");

  const handleLookup = async () => {
    if (!qrCode.trim()) return;
    setLoading(true);
    try {
      // Extract customer ID from QR code (format: JIWAR-<uuid>)
      const customerId = qrCode.replace("JIWAR-", "").trim();

      const { data: custData, error: custError } = await supabase
        .from("customers")
        .select("id, available_balance, credit_limit, user_id")
        .eq("id", customerId)
        .single();

      if (custError || !custData) {
        toast.error("كود غير صالح أو العميل غير موجود");
        return;
      }

      // Get profile name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", custData.user_id)
        .single();

      setCustomerInfo({ ...custData, full_name: profileData?.full_name || "عميل" });
      setStep("confirm");
    } catch {
      toast.error("حدث خطأ في البحث");
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("أدخل مبلغاً صالحاً");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("process_transaction", {
        p_customer_id: customerInfo.id,
        p_merchant_id: merchantId,
        p_amount: numAmount,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`تمت العملية بنجاح! رقم المعاملة: ${(data as string).slice(0, 8)}`);
      setOpen(false);
      resetState();
      onSuccess();
    } catch {
      toast.error("حدث خطأ في تنفيذ العملية");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setQrCode("");
    setAmount("");
    setCustomerInfo(null);
    setStep("scan");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground font-bold text-lg px-8 py-6 rounded-xl glow-green">
          <ScanLine className="w-5 h-5 ml-2" />
          مسح كود العميل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">
            {step === "scan" ? "أدخل كود العميل" : "تأكيد العملية"}
          </DialogTitle>
        </DialogHeader>

        {step === "scan" ? (
          <div className="space-y-4 py-4">
            <div>
              <Label className="font-cairo">كود QR الخاص بالعميل</Label>
              <Input
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="JIWAR-xxxxxxxx"
                dir="ltr"
                className="mt-1"
              />
            </div>
            <Button onClick={handleLookup} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
              {loading ? "جارٍ البحث..." : "بحث عن العميل"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground font-ibm">العميل</p>
              <p className="font-cairo font-bold text-foreground text-lg">
                {customerInfo?.full_name || "عميل"}
              </p>
              <p className="text-sm text-primary font-ibm mt-1">
                الرصيد المتاح: {customerInfo?.available_balance} ر.س
              </p>
            </div>
            <div>
              <Label className="font-cairo">المبلغ (ر.س)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                dir="ltr"
                className="mt-1 text-center text-2xl font-bold"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("scan")} className="flex-1">رجوع</Button>
              <Button onClick={handleProcess} disabled={loading} className="flex-1 bg-gradient-primary text-primary-foreground">
                {loading ? "جارٍ التنفيذ..." : "تأكيد الدفع"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;
