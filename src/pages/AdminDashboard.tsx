import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminMerchants from "@/components/admin/AdminMerchants";
import AdminCustomers from "@/components/admin/AdminCustomers";
import AdminTransactions from "@/components/admin/AdminTransactions";

type AdminTab = "overview" | "merchants" | "customers" | "transactions";

const AdminDashboard = () => {
  const { user, loading, role } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-cairo text-lg">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!user || role !== "admin") return <Navigate to="/auth" replace />;

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <AdminOverview />;
      case "merchants": return <AdminMerchants />;
      case "customers": return <AdminCustomers />;
      case "transactions": return <AdminTransactions />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 bg-background overflow-auto">
          {renderContent()}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
