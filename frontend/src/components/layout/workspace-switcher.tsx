import { ChevronDown } from "lucide-react";

import { mockWorkspaces } from "@/config/workspaces";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function WorkspaceSwitcher() {
  const workspace = mockWorkspaces[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted font-semibold">
            {workspace.name.charAt(0)}
          </div>

          <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{workspace.name}</span>
          </div>

          <ChevronDown className="size-4 opacity-60 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
