import { Link, useLocation } from "react-router-dom";

import { appNavigation } from "@/config/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarNavigation() {
  const location = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {appNavigation.map((item) => {
            const Icon = item.icon;

            const isActive =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <Link to={item.to}>
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
