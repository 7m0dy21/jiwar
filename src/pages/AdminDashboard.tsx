import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar, { type AdminTab } from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminCustomers from "@/components/admin/AdminCustomers";
import AdminMerchants from "@/components/admin/AdminMerchants";
import AdminTransactions from "@/components/admin/AdminTransactions";
import AdminReports from "@/components/admin/AdminReports";
import AdminCreateUser from "@/components/admin/AdminCreateUser";
import AdminManagers from "@/components/admin/AdminManagers";

const AdminDashboard = () => {
  const { user, loading, role } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground font-cairo text-lg">جارٍ التحميل...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;

  const render = () => {
    switch (activeTab) {
      case "overview": return <AdminOverview />;
      case "customers": return <AdminCustomers />;
      case "merchants": return <AdminMerchants />;
      case "transactions": return <AdminTransactions />;
      case "reports": return <AdminReports />;
      case "create": return <AdminCreateUser />;
      case "managers": return <AdminManagers />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 bg-background overflow-auto">{render()}</main>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
