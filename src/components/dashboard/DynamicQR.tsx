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
  const [mode, setMode] = useState<"dynamic" | "static">("dynamic");
  const [token, setToken] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [staticToken, setStaticToken] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [staticError, setStaticError] = useState<string>("");

  const readServerError = async (error: any, data: any) => {
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
      } catch {}
    }
    return serverMsg || data?.error || error?.message || "";
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("qr-pay", {
        body: { action: "generate" },
      });
      const serverMsg = await readServerError(error, data);
      if (error || !data?.token) {
        const msg = serverMsg || "تعذر توليد الكود";
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

  const generateStatic = useCallback(async () => {
    setStaticError("");
    try {
      const { data, error } = await supabase.functions.invoke("qr-pay", {
        body: { action: "generate_static" },
      });
      const serverMsg = await readServerError(error, data);
      if (error || !data?.token) {
        setStaticError(serverMsg || "تعذر توليد الكود الثابت");
        return;
      }
      setStaticToken(data.token);
      setAccountNumber(data.account_number || "");
    } catch (e: any) {
      setStaticError(e?.message || "تعذر الاتصال بالخادم");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "dynamic") generate();
    if (!staticToken) generateStatic();
  }, [open, mode, generate, generateStatic, staticToken]);

  useEffect(() => {
    if (!open || mode !== "dynamic" || !expiresAt) return;
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
  }, [open, mode, expiresAt, generate]);

  const activeToken = mode === "dynamic" ? token : staticToken;
  const activeError = mode === "dynamic" ? errorMsg : staticError;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/5">
          <QrCode className="w-5 h-5 ml-2 text-primary" />
          عرض كود الدفع
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">كود الدفع</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant={mode === "dynamic" ? "default" : "outline"}
            onClick={() => setMode("dynamic")}
          >
            متجدد (60 ثانية)
          </Button>
          <Button
            size="sm"
            variant={mode === "static" ? "default" : "outline"}
            onClick={() => setMode("static")}
          >
            ثابت (رقم حسابك)
          </Button>
        </div>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-2xl relative min-h-[312px] min-w-[312px] flex items-center justify-center">
            {activeToken ? (
              <QRCodeSVG value={activeToken} size={280} level="M" marginSize={2} />
            ) : activeError ? (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center text-center gap-2 px-2">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-destructive font-cairo">{activeError}</p>
                <Button size="sm" variant="outline" onClick={mode === "dynamic" ? generate : generateStatic} disabled={loading}>
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

          {accountNumber && (
            <div className="w-full bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground font-cairo mb-1">رقم حسابك (ثابت)</p>
              <div className="flex items-center justify-center gap-2">
                <p dir="ltr" className="font-mono font-bold text-primary text-2xl tracking-widest">
                  {accountNumber}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(accountNumber);
                      toast.success("تم نسخ رقم الحساب");
                    } catch {
                      toast.error("تعذر النسخ");
                    }
                  }}
                  aria-label="نسخ رقم الحساب"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground font-cairo mt-1">
                يمكن للتاجر إدخاله يدوياً بدل مسح الكود
              </p>
            </div>
          )}

          {mode === "dynamic" && token && (
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
            </>
          )}

          {mode === "static" && staticToken && (
            <p className="text-xs text-muted-foreground font-ibm">
              هذا الكود ثابت مربوط برقم حسابك - يتعرف عليه التاجر مباشرة
            </p>
          )}

          {activeToken && (
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground font-cairo text-right">
                أو أعطِ التاجر الكود لإدخاله يدوياً:
              </p>
              <div className="flex items-stretch gap-2">
                <div
                  dir="ltr"
                  className="flex-1 bg-muted rounded-lg p-2 text-[10px] font-mono break-all text-left max-h-24 overflow-auto select-all"
                >
                  {activeToken}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(activeToken);
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DynamicQR;
