import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import MerchantDashboard from "@/components/dashboard/MerchantDashboard";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";

const Dashboard = () => {
  const { user, loading, role } = useAuth();

  if (loading || (user && role === null)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground font-cairo text-lg">جارٍ تجهيز حسابك...</p>
        <p className="text-xs text-muted-foreground font-ibm">يتم التحقق من الصلاحيات</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;

  return role === "merchant" ? <MerchantDashboard /> : <CustomerDashboard />;
};

export default Dashboard;
