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

  const verifyNafath = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    await supabase.from("customer_verifications").insert({
      customer_id: customerId, provider: "nafath", status: "approved",
      reference: "NAF-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      details: { method: "mock", verified_at: new Date().toISOString() },
    });
    await supabase.from("customers").update({ nafath_verified: true }).eq("id", customerId);
    setLoading(false);
    toast.success("تم التحقق عبر نفاذ ✓");
    setStep("simah");
  };

  const verifySimah = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    const score = 650 + Math.floor(Math.random() * 200);
    await supabase.from("customer_verifications").insert({
      customer_id: customerId, provider: "simah", status: "approved",
      reference: "SIM-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      details: { score, method: "mock" },
    });
    await supabase.from("customers").update({ simah_score: score }).eq("id", customerId);
    setLoading(false);
    toast.success(`تم الفحص الائتماني عبر سمة ✓ النقاط: ${score}`);
    setStep("nafith");
  };

  const signNafith = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    await supabase.from("customer_verifications").insert({
      customer_id: customerId, provider: "nafith", status: "approved",
      reference: "NFZ-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      details: { signed_at: new Date().toISOString(), method: "mock" },
    });
    await supabase.from("customers").update({ nafith_signed: true, onboarding_completed: true }).eq("id", customerId);
    setLoading(false);
    toast.success("تم توقيع السند الإلكتروني ✓");
    setStep("done");
    setTimeout(() => { setOpen(false); onComplete(); }, 1500);
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
