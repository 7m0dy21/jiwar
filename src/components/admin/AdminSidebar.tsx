import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { Users, Store, ArrowLeftRight, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export type AdminTab = "customers" | "merchants" | "transactions" | "managers";

interface Props { activeTab: AdminTab; onTabChange: (t: AdminTab) => void; }

const items: { key: AdminTab; label: string; icon: any }[] = [
  { key: "customers", label: "العملاء", icon: Users },
  { key: "merchants", label: "التجار", icon: Store },
  { key: "transactions", label: "المعاملات", icon: ArrowLeftRight },
  { key: "managers", label: "المشرفون", icon: ShieldCheck },
];

const AdminSidebar = ({ activeTab, onTabChange }: Props) => {
  const { signOut, user } = useAuth();
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border">
        <h2 className="font-cairo font-bold text-lg">لوحة الإدارة</h2>
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.key}>
                  <SidebarMenuButton isActive={activeTab === it.key} onClick={() => onTabChange(it.key)}>
                    <it.icon className="w-4 h-4" />
                    <span className="font-cairo">{it.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border">
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
          <LogOut className="w-4 h-4" /> تسجيل الخروج
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
