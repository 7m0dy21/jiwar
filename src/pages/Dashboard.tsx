import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import MerchantDashboard from "@/components/dashboard/MerchantDashboard";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";

const Dashboard = () => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-cairo text-lg">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return role === "merchant" ? <MerchantDashboard /> : <CustomerDashboard />;
};

export default Dashboard;
