import { Link, useLocation } from "react-router-dom";

import { appRoutesConfig } from "@/config/routes";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { MyTasksSection } from "./my-tasks-section";

export function SidebarNavigation() {
  const location = useLocation();

  const navigationItems = appRoutesConfig.filter((route) => route.showInSidebar);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:items-center">
      <SidebarGroupContent className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <SidebarMenu>
          {navigationItems.map((route) => {
            const Icon = route.icon!;

            const isActive =
              location.pathname === route.path || location.pathname.startsWith(`${route.path}/`);

            return (
              <SidebarMenuItem key={route.path}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <Link to={route.path}>
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{route.navigationLabel}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          <MyTasksSection />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
