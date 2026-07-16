import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import MerchantDashboard from "@/components/dashboard/MerchantDashboard";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LogOut, Copy } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, loading, role, roleError, retryRole, signOut } = useAuth();

  if (loading || (user && role === null && !roleError)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground font-cairo text-lg">جارٍ تجهيز حسابك...</p>
        <p className="text-xs text-muted-foreground font-ibm">يتم التحقق من الصلاحيات</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (roleError) {
    const copyId = async () => {
      try {
        await navigator.clipboard.writeText(roleError.correlationId);
        toast.success("تم نسخ معرّف الخطأ");
      } catch {
        toast.error("تعذر النسخ");
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="role-error-screen">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-card space-y-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="font-cairo font-bold text-foreground text-xl">
              تعذر تحميل صلاحيات الحساب
            </h2>
            <p className="text-sm text-muted-foreground font-ibm">
              حدث خطأ أثناء التحقق من صلاحياتك بعد {roleError.attempts} محاولات.
              قد يكون الاتصال بالإنترنت غير مستقر أو أن الخادم يواجه ضغطاً مؤقتاً.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-3 space-y-2 text-right">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground font-ibm">معرّف الخطأ</span>
              <button
                onClick={copyId}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-ibm"
                data-testid="copy-error-id"
              >
                <Copy className="w-3 h-3" />
                نسخ
              </button>
            </div>
            <p className="font-mono text-sm text-foreground break-all" data-testid="error-correlation-id">
              {roleError.correlationId}
            </p>
            {roleError.code && (
              <>
                <span className="text-xs text-muted-foreground font-ibm">رمز الخطأ</span>
                <p className="font-mono text-xs text-foreground break-all">{roleError.code}</p>
              </>
            )}
            <span className="text-xs text-muted-foreground font-ibm">التفاصيل</span>
            <p className="text-xs text-foreground break-words font-ibm">{roleError.message}</p>
            {roleError.hint && (
              <>
                <span className="text-xs text-muted-foreground font-ibm">تلميح</span>
                <p className="text-xs text-foreground break-words font-ibm">{roleError.hint}</p>
              </>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground font-ibm text-center">
            عند التواصل مع الدعم، أرسل معرّف الخطأ أعلاه لتسريع الحل.
          </p>

          <div className="flex flex-col gap-2">
            <Button
              onClick={retryRole}
              className="bg-gradient-primary text-primary-foreground font-cairo gap-2"
              data-testid="retry-role"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </Button>
            <Button variant="ghost" onClick={signOut} className="font-cairo gap-2">
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (role === "admin") return <Navigate to="/admin" replace />;

  return role === "merchant" ? <MerchantDashboard /> : <CustomerDashboard />;
};

export default Dashboard;
