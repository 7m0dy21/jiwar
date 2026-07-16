import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw, Copy, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DynamicQRProps {
  customerName: string;
}

const DynamicQR = ({ customerName }: DynamicQRProps) => {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const generate = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("qr-pay", {
        body: { action: "generate" },
      });

      // Extract server-side error message even when HTTP status != 2xx
      let serverMsg: string | null = null;
      if (error) {
        const ctx: any = (error as any).context;
        try {
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            serverMsg = j?.error || null;
          } else if (ctx && typeof ctx.text === "function") {
            const t = await ctx.text();
            try { serverMsg = JSON.parse(t)?.error || t; } catch { serverMsg = t; }
          }
        } catch { /* ignore */ }
      }

      if (error || !data?.token) {
        const msg = serverMsg || data?.error || error?.message || "تعذر توليد الكود";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      setToken(data.token);
      setExpiresAt(data.expires_at);
    } catch (e: any) {
      const msg = e?.message || "تعذر الاتصال بالخادم";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    generate();
  }, [open, generate]);

  useEffect(() => {
    if (!open || !expiresAt) return;
    let refreshing = false;
    const tick = () => {
      const left = expiresAt - Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 8 && !refreshing) {
        refreshing = true;
        generate();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, expiresAt, generate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/5">
          <QrCode className="w-5 h-5 ml-2 text-primary" />
          عرض كود الدفع الديناميكي
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">كود الدفع الآمن</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-2xl relative min-h-[312px] min-w-[312px] flex items-center justify-center">
            {token ? (
              <QRCodeSVG value={token} size={280} level="M" marginSize={2} />
            ) : errorMsg ? (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center text-center gap-2 px-2">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-destructive font-cairo">{errorMsg}</p>
                <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                  <RefreshCw className="w-4 h-4 ml-1" />
                  إعادة المحاولة
                </Button>
              </div>
            ) : (
              <div className="w-[280px] h-[280px] flex items-center justify-center text-muted-foreground font-cairo">
                {loading ? "جارٍ التوليد..." : "..."}
              </div>
            )}
          </div>
          <p className="font-cairo font-bold text-foreground text-lg">{customerName}</p>
          {token && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
                <span className="font-ibm text-muted-foreground">
                  يتجدد خلال <span className="font-bold text-primary">{remaining}</span> ثانية
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, (remaining / 60) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground font-ibm">
                أظهر هذا الكود للتاجر - يتغير كل 60 ثانية لحمايتك
              </p>

              <div className="w-full space-y-2">
                <p className="text-xs text-muted-foreground font-cairo text-right">
                  أو أعطِ التاجر الكود لإدخاله يدوياً:
                </p>
                <div className="flex items-stretch gap-2">
                  <div
                    dir="ltr"
                    className="flex-1 bg-muted rounded-lg p-2 text-[10px] font-mono break-all text-left max-h-24 overflow-auto select-all"
                  >
                    {token}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(token);
                        toast.success("تم نسخ الكود");
                      } catch {
                        toast.error("تعذر النسخ - اضغط مطولاً على الكود لتحديده");
                      }
                    }}
                    aria-label="نسخ الكود"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DynamicQR;
