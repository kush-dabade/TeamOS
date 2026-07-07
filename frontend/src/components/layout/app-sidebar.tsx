import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

import { SidebarBrand } from "./sidebar-brand";
import { SidebarNavigation } from "./sidebar-navigation";
import { SidebarUser } from "./sidebar-user";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="flex-1">
        <SidebarNavigation />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
