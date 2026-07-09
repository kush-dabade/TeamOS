import { ChevronDown } from "lucide-react";

import { mockWorkspaces } from "@/config/workspaces";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function WorkspaceSwitcher() {
  const workspace = mockWorkspaces[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="h-14 rounded-lg transition-colors">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-semibold">
            {workspace.name.charAt(0)}
          </div>

          <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{workspace.name}</span>

            <span className="text-muted-foreground truncate text-xs">Owner</span>
          </div>

          <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
