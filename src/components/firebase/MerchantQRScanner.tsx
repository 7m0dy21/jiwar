import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onDetected: (accountNumber: string) => void;
}

/**
 * Live camera scanner. Extracts 10-digit account_number from any QR payload.
 * We accept either a bare 10-digit string or the last 10-digit run inside the payload.
 */
const MerchantQRScanner = ({ onDetected }: Props) => {
  const [open, setOpen] = useState(false);
  const containerId = "merchant-qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (cancelled) return;
          const match = decoded.match(/\d{10}/);
          if (!match) {
            toast.error("QR غير صالح - لا يحتوي على رقم حساب مكوّن من 10 أرقام");
            return;
          }
          cancelled = true;
          onDetected(match[0]);
          setOpen(false);
        },
        () => { /* scan errors are per-frame; ignore */ },
      )
      .catch((e) => {
        toast.error(e?.message || "تعذّر فتح الكاميرا");
        setOpen(false);
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
      }
    };
  }, [open, onDetected]);

  return (
    <>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Camera className="w-4 h-4" /> مسح كود العميل
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="bg-background rounded-2xl p-4 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold">وجّه الكاميرا نحو QR العميل</p>
              <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div id={containerId} className="w-full rounded-lg overflow-hidden" />
          </div>
        </div>
      )}
    </>
  );
};

export default MerchantQRScanner;
