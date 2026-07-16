import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import MerchantDashboard from "@/components/dashboard/MerchantDashboard";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="font-cairo font-bold text-foreground text-xl">
            تعذر تحميل صلاحيات الحساب
          </h2>
          <p className="text-sm text-muted-foreground font-ibm">
            حدث خطأ أثناء التحقق من صلاحياتك. قد يكون الاتصال بالإنترنت غير مستقر.
          </p>
          <p className="text-xs text-muted-foreground font-ibm bg-muted rounded-lg p-2 break-words">
            {roleError}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={retryRole}
              className="bg-gradient-primary text-primary-foreground font-cairo gap-2"
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
