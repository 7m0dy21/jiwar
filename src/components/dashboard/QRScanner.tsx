import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Camera } from "lucide-react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";

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
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));

  const startCamera = async () => {
    try {
      const scanner = new Html5Qrcode(scannerContainerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setQrCode(decodedText);
          stopCamera();
          // Auto-lookup after scan
          handleLookupWithCode(decodedText);
        },
        () => {} // ignore errors during scanning
      );
      setCameraActive(true);
    } catch (err) {
      toast.error("لا يمكن الوصول إلى الكاميرا");
      console.error("Camera error:", err);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  const handleLookupWithCode = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const trimmed = code.trim();
      // Only signed, time-limited dynamic tokens are accepted.
      // Format: JIWARv2.<customerId>.<ts>.<sig>
      if (!trimmed.startsWith("JIWARv2.")) {
        toast.error("كود غير صالح - يجب استخدام كود QR الديناميكي الآمن من تطبيق العميل");
        return;
      }
      const parts = trimmed.split(".");
      if (parts.length !== 4) { toast.error("كود غير صالح"); return; }
      const customerId = parts[1];
      const ts = parseInt(parts[2], 10);
      const ageSec = Math.floor(Date.now() / 1000) - ts;
      if (ageSec > 60) { toast.error("انتهت صلاحية الكود - اطلب من العميل تحديثه"); return; }

      const { data: custData, error: custError } = await supabase
        .from("customers")
        .select("id, available_balance, credit_limit, user_id, onboarding_completed")
        .eq("id", customerId)
        .single();
      if (custError || !custData) { toast.error("العميل غير موجود"); return; }
      if (!custData.onboarding_completed) { toast.error("لم يكمل العميل التحقق بعد"); return; }

      const { data: profileData } = await supabase
        .from("profiles").select("full_name").eq("user_id", custData.user_id).single();
      setCustomerInfo({ ...custData, full_name: profileData?.full_name || "عميل", _dynamicToken: trimmed });
      setStep("confirm");
    } catch {
      toast.error("حدث خطأ في البحث");
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = () => handleLookupWithCode(qrCode);

  const [failureReason, setFailureReason] = useState<string>("");

  const handleProcess = async () => {
    setFailureReason("");
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { setFailureReason("أدخل مبلغاً صالحاً"); toast.error("أدخل مبلغاً صالحاً"); return; }
    if (numAmount > customerInfo?.available_balance) {
      setFailureReason(`المبلغ (${numAmount} ر.س) أكبر من رصيد العميل المتاح (${customerInfo?.available_balance} ر.س)`);
      toast.error("المبلغ أكبر من رصيد العميل المتاح"); return;
    }
    if (!customerInfo?._dynamicToken) {
      const msg = "يجب استخدام كود QR الديناميكي الآمن";
      setFailureReason(msg); toast.error(msg); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-pay", {
        body: { action: "pay", token: customerInfo._dynamicToken, amount: numAmount },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "فشل الدفع";
        setFailureReason(msg); toast.error(msg); return;
      }
      toast.success(`تمت العملية بنجاح! رقم: ${(data.transaction_id as string).slice(0, 8)}`);
      setOpen(false); resetState(); onSuccess();
    } catch (e: any) {
      const msg = e?.message || "حدث خطأ في تنفيذ العملية";
      setFailureReason(msg); toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    stopCamera();
    setQrCode("");
    setAmount("");
    setCustomerInfo(null);
    setStep("scan");
    setFailureReason("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) resetState();
      else setTimeout(() => { startCamera(); }, 150);
    }}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground font-bold text-lg px-8 py-6 rounded-xl glow-green">
          <ScanLine className="w-5 h-5 ml-2" />
          مسح كود العميل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">
            {step === "scan" ? "مسح كود العميل" : "تأكيد العملية"}
          </DialogTitle>
        </DialogHeader>

        {step === "scan" ? (
          <div className="space-y-4 py-4">
            {/* Camera scanner area */}
            <div className="relative rounded-xl overflow-hidden bg-muted" style={{ minHeight: cameraActive ? 280 : 0 }}>
              <div id={scannerContainerRef.current} />
            </div>

            {!cameraActive && (
              <Button onClick={startCamera} variant="outline" className="w-full font-cairo gap-2">
                <Camera className="w-4 h-4" />
                فتح الكاميرا للمسح
              </Button>
            )}

            {cameraActive && (
              <Button onClick={stopCamera} variant="outline" className="w-full font-cairo text-destructive">
                إيقاف الكاميرا
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground font-ibm">أو أدخل الكود يدوياً</span></div>
            </div>

            <div>
              <Label className="font-cairo">كود QR الخاص بالعميل</Label>
              <Input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="JIWAR-xxxxxxxx" dir="ltr" className="mt-1" />
            </div>
            <Button onClick={handleLookup} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
              {loading ? "جارٍ البحث..." : "بحث عن العميل"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground font-ibm">العميل</p>
              <p className="font-cairo font-bold text-foreground text-lg">{customerInfo?.full_name || "عميل"}</p>
              <p className="text-sm text-primary font-ibm mt-1">الرصيد المتاح: {customerInfo?.available_balance} ر.س</p>
              {customerInfo?._dynamicToken && (
                <p className="text-xs text-primary font-ibm mt-1">✓ كود ديناميكي آمن</p>
              )}
            </div>
            <div>
              <Label className="font-cairo">المبلغ (ر.س)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" dir="ltr" className="mt-1 text-center text-2xl font-bold" min="0.01" step="0.01" />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground font-ibm">المبلغ المطلوب خصمه</p>
                <p className="font-cairo font-bold text-primary text-2xl">{parseFloat(amount).toFixed(2)} ر.س</p>
              </div>
            )}
            {failureReason && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center">
                <p className="text-xs font-cairo font-bold text-destructive mb-1">سبب فشل التحقق</p>
                <p className="text-sm text-destructive font-ibm">{failureReason}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("scan"); setFailureReason(""); }} className="flex-1">رجوع</Button>
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
