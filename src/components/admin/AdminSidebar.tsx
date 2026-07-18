import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Store, ArrowLeftRight, ShieldCheck, LogOut, FileText, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export type AdminTab = "overview" | "customers" | "merchants" | "transactions" | "reports" | "create" | "managers";

interface Props { activeTab: AdminTab; onTabChange: (t: AdminTab) => void; }

const iconMap: Record<AdminTab, any> = {
  overview: LayoutDashboard, customers: Users, merchants: Store,
  transactions: ArrowLeftRight, reports: FileText, create: UserPlus, managers: ShieldCheck,
};
const order: AdminTab[] = ["overview", "customers", "merchants", "transactions", "reports", "create", "managers"];

const AdminSidebar = ({ activeTab, onTabChange }: Props) => {
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-cairo font-bold text-lg">{t("admin.title")}</h2>
          <LanguageSwitcher />
        </div>
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {order.map((key) => {
                const Icon = iconMap[key];
                return (
                  <SidebarMenuItem key={key}>
                    <SidebarMenuButton isActive={activeTab === key} onClick={() => onTabChange(key)}>
                      <Icon className="w-4 h-4" />
                      <span className="font-cairo">{t(`admin.tabs.${key}`)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border">
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
          <LogOut className="w-4 h-4" /> {t("common.logout")}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
