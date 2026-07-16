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

  const lastAttemptRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const normalizeScanned = (raw: string): string | null => {
    if (!raw) return null;
    let s = raw
      .normalize("NFKC")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/[．。｡]/g, ".")
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "");
    // If it's a URL that embeds the token, try to extract it
    try {
      if (/^https?:\/\//i.test(s)) {
        const u = new URL(s);
        const fromQuery = u.searchParams.get("t") || u.searchParams.get("token");
        if (fromQuery) s = fromQuery;
        else s = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || s);
      }
    } catch {}
    s = decodeURIComponent(s).replace(/\s+/g, "");
    const v3 = s.match(/JIWARv3\.[0-9a-f]{32}\.[0-9a-f]{32}\.[0-9a-z]+\.[A-Za-z0-9_-]{20,64}/i);
    if (v3) return v3[0].replace(/^jiwarv3/i, "JIWARv3");

    const v2 = s.match(/JIWARv2\.[A-Fa-f0-9-]{36}(?:\.[A-Fa-f0-9-]{36})?\.\d+\.[A-Fa-f0-9]{64}/i);
    return v2 ? v2[0].replace(/^jiwarv2/i, "JIWARv2") : null;
  };

  const startCamera = async () => {
    try {
      const scanner = new Html5Qrcode(scannerContainerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const token = normalizeScanned(decodedText);
          if (!token) return; // keep scanning until a valid token appears
          const now = Date.now();
          // Debounce duplicate reads
          if (lastAttemptRef.current.code === token && now - lastAttemptRef.current.at < 2000) return;
          lastAttemptRef.current = { code: token, at: now };
          setQrCode(token);
          stopCamera();
          handleLookupWithCode(token);
        },
        () => {} // ignore per-frame errors
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
      const dynamicToken = normalizeScanned(code) || code.trim();
      if (dynamicToken.startsWith("JIWARv2.")) {
        toast.error("الكود قديم - اطلب من العميل إغلاق نافذة QR وفتحها مرة أخرى لتوليد كود جديد");
        return;
      }
      if (!dynamicToken.startsWith("JIWARv3.")) {
        toast.error("كود غير صالح - يجب استخدام كود QR الديناميكي الآمن من تطبيق العميل");
        return;
      }
      const { data, error } = await supabase.functions.invoke("qr-pay", {
        body: { action: "lookup", token: dynamicToken },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "تعذر التعرف على العميل");
        return;
      }
      setCustomerInfo({ ...data.customer, _dynamicToken: dynamicToken });
      if (data.customer?.verification_reason) {
        setFailureReason(data.customer.verification_reason);
      }
      setStep("confirm");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ في البحث");
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = () => handleLookupWithCode(qrCode);

  const [failureReason, setFailureReason] = useState<string>("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [waitingApproval, setWaitingApproval] = useState(false);

  // Subscribe to the created request to see customer's decision in realtime
  useEffect(() => {
    if (!pendingRequestId) return;
    const ch = supabase
      .channel(`req-${pendingRequestId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_requests", filter: `id=eq.${pendingRequestId}` },
        (payload) => {
          const row: any = payload.new;
          if (row.status === "approved") {
            toast.success(`تمت الموافقة! رقم العملية: ${String(row.transaction_id).slice(0, 8)}`);
            setWaitingApproval(false); setPendingRequestId(null);
            setOpen(false); resetState(); onSuccess();
          } else if (row.status === "rejected") {
            setFailureReason("رفض العميل الطلب"); toast.error("رفض العميل الطلب");
            setWaitingApproval(false); setPendingRequestId(null);
          } else if (row.status === "expired" || row.status === "failed") {
            setFailureReason(row.reason || "فشل الطلب"); toast.error(row.reason || "فشل الطلب");
            setWaitingApproval(false); setPendingRequestId(null);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pendingRequestId]);

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
    if (customerInfo?.can_pay === false) {
      const msg = customerInfo?.verification_reason || "تم التعرف على العميل، لكنه غير جاهز للدفع";
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
      if (data?.pending && data?.request_id) {
        setPendingRequestId(data.request_id);
        setWaitingApproval(true);
        toast.info("تم إرسال الطلب للعميل - بانتظار الموافقة");
      }
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
    setPendingRequestId(null);
    setWaitingApproval(false);
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
              <Input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="JIWARv3..." dir="ltr" className="mt-1" />
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
            {waitingApproval && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-sm font-cairo font-bold text-primary">بانتظار موافقة العميل...</p>
                <p className="text-xs text-muted-foreground font-ibm mt-1">تظهر لدى العميل نافذة الموافقة أو الرفض</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("scan"); setFailureReason(""); }} disabled={waitingApproval} className="flex-1">رجوع</Button>
              <Button onClick={handleProcess} disabled={loading || waitingApproval} className="flex-1 bg-gradient-primary text-primary-foreground">
                {waitingApproval ? "بانتظار العميل..." : loading ? "جارٍ الإرسال..." : "إرسال للعميل"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;
