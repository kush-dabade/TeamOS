import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

import { SidebarBrand } from "./sidebar-brand";
import { SidebarNavigation } from "./sidebar-navigation";
import { SidebarUser } from "./sidebar-user";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-3">
        <SidebarBrand />
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent className="flex-1">
        <SidebarNavigation />
      </SidebarContent>

      <SidebarFooter className="pt-3">
        <SidebarUser />
      </SidebarFooter>
    </Sidebar>
  );
}
