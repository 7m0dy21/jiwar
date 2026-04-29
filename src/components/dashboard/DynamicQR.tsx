import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw } from "lucide-react";
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

  const generate = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("qr-pay", {
      body: { action: "generate" },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || "تعذر توليد الكود");
      return;
    }
    setToken(data.token);
    setExpiresAt(data.expires_at);
  }, []);

  useEffect(() => {
    if (!open) return;
    generate();
  }, [open, generate]);

  useEffect(() => {
    if (!open || !expiresAt) return;
    const tick = () => {
      const left = expiresAt - Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) generate();
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
          <div className="bg-white p-6 rounded-2xl relative">
            {token ? (
              <QRCodeSVG value={token} size={220} level="H" />
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-muted-foreground">
                {loading ? "جارٍ التوليد..." : "..."}
              </div>
            )}
          </div>
          <p className="font-cairo font-bold text-foreground text-lg">{customerName}</p>
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4 text-primary" />
            <span className="font-ibm text-muted-foreground">
              يتجدد خلال <span className="font-bold text-primary">{remaining}</span> ثانية
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-1000"
              style={{ width: `${(remaining / 60) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground font-ibm">
            أظهر هذا الكود للتاجر - يتغير كل 60 ثانية لحمايتك
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DynamicQR;
