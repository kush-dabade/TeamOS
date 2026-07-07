import { ChevronUp } from "lucide-react";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function SidebarUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="w-full group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
            KD
          </div>

          <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">Kush Dabade</span>

            <span className="truncate text-xs text-muted-foreground">kush@example.com</span>
          </div>

          <ChevronUp className="size-4 shrink-0 opacity-60 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
