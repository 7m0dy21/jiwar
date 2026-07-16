import { useAuth } from "@/hooks/useAuth";
import jiwarLogo from "@/assets/jiwar-logo.png";
import { LayoutDashboard, Store, Users, Receipt, LogOut, ShieldCheck, ShieldAlert, SlidersHorizontal, AlertTriangle, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type AdminTab = "overview" | "merchants" | "customers" | "transactions" | "managers" | "risk" | "limits" | "errors" | "role-audit";

const items: { title: string; id: AdminTab; icon: any }[] = [
  { title: "نظرة عامة", id: "overview", icon: LayoutDashboard },
  { title: "التجار", id: "merchants", icon: Store },
  { title: "العملاء", id: "customers", icon: Users },
  { title: "المعاملات", id: "transactions", icon: Receipt },
  { title: "المخاطر", id: "risk", icon: ShieldAlert },
  { title: "حدود العمليات", id: "limits", icon: SlidersHorizontal },
  { title: "تقارير الأخطاء", id: "errors", icon: AlertTriangle },
  { title: "تدقيق الصلاحيات", id: "role-audit", icon: ShieldQuestion },
  { title: "المشرفين", id: "managers", icon: ShieldCheck },
];

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <img src={jiwarLogo} alt="جوار" className="w-9 h-9 flex-shrink-0" />
        <span className="font-cairo font-bold text-foreground group-data-[collapsible=icon]:hidden">
          لوحة التحكم
        </span>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-cairo">الإدارة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.id)}
                    isActive={activeTab === item.id}
                    tooltip={item.title}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-cairo">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto p-4 border-t border-border">
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground">
          <LogOut className="w-4 h-4 ml-2" />
          <span className="group-data-[collapsible=icon]:hidden font-cairo">خروج</span>
        </Button>
      </div>
    </Sidebar>
  );
};

export default AdminSidebar;
