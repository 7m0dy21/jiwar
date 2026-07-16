import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, FileText, FileSignature, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OnboardingFlowProps {
  customerId: string;
  status: { nafath: boolean; simah: boolean; nafith: boolean };
  onComplete: () => void;
}

type Step = "nafath" | "simah" | "nafith" | "done";

const OnboardingFlow = ({ customerId, status, onComplete }: OnboardingFlowProps) => {
  const [open, setOpen] = useState(false);
  const initial: Step = !status.nafath ? "nafath" : !status.simah ? "simah" : !status.nafith ? "nafith" : "done";
  const [step, setStep] = useState<Step>(initial);
  const [loading, setLoading] = useState(false);

  const progress = step === "nafath" ? 0 : step === "simah" ? 33 : step === "nafith" ? 66 : 100;

  const runStep = async (which: "nafath" | "simah" | "nafith") => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const { data, error } = await supabase.functions.invoke("verify-onboarding", {
        body: { step: which },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "فشل التحقق");
      }
      return data as any;
    } finally {
      setLoading(false);
    }
  };

  const verifyNafath = async () => {
    try {
      await runStep("nafath");
      toast.success("تم التحقق عبر نفاذ ✓");
      setStep("simah");
    } catch (e: any) { toast.error(e.message); }
  };

  const verifySimah = async () => {
    try {
      const res = await runStep("simah");
      toast.success(`تم الفحص الائتماني عبر سمة ✓ النقاط: ${res?.score ?? ""}`);
      setStep("nafith");
    } catch (e: any) { toast.error(e.message); }
  };

  const signNafith = async () => {
    try {
      await runStep("nafith");
      toast.success("تم توقيع السند الإلكتروني ✓");
      setStep("done");
      setTimeout(() => { setOpen(false); onComplete(); }, 1500);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-gradient-primary text-primary-foreground font-cairo font-bold py-6">
          <ShieldCheck className="w-5 h-5 ml-2" />
          أكمل التحقق لتفعيل الائتمان
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl text-center">تفعيل حساب الائتمان</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground font-ibm">{progress}% مكتمل</p>

          {step === "nafath" && (
            <Card className="p-6 text-center space-y-4">
              <ShieldCheck className="w-12 h-12 mx-auto text-primary" />
              <h3 className="font-cairo font-bold text-lg">التحقق عبر نفاذ</h3>
              <p className="text-sm text-muted-foreground font-ibm">سيتم التحقق من هويتك الوطنية عبر منصة نفاذ</p>
              <Button onClick={verifyNafath} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                {loading ? "جارٍ التحقق..." : "تحقق الآن"}
              </Button>
            </Card>
          )}

          {step === "simah" && (
            <Card className="p-6 text-center space-y-4">
              <FileText className="w-12 h-12 mx-auto text-primary" />
              <h3 className="font-cairo font-bold text-lg">الفحص الائتماني عبر سمة</h3>
              <p className="text-sm text-muted-foreground font-ibm">سيتم فحص سجلك الائتماني لتحديد الحد المناسب</p>
              <Button onClick={verifySimah} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                {loading ? "جارٍ الفحص..." : "ابدأ الفحص"}
              </Button>
            </Card>
          )}

          {step === "nafith" && (
            <Card className="p-6 text-center space-y-4">
              <FileSignature className="w-12 h-12 mx-auto text-primary" />
              <h3 className="font-cairo font-bold text-lg">توقيع سند نافذ</h3>
              <p className="text-sm text-muted-foreground font-ibm">إصدار سند إلكتروني يحفظ حقوق التجار</p>
              <Button onClick={signNafith} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                {loading ? "جارٍ التوقيع..." : "وقّع السند"}
              </Button>
            </Card>
          )}

          {step === "done" && (
            <Card className="p-6 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
              <h3 className="font-cairo font-bold text-lg">تم التفعيل بنجاح ✓</h3>
              <p className="text-sm text-muted-foreground font-ibm">يمكنك الآن استخدام جوار في جميع المتاجر</p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingFlow;
