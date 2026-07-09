import { ChevronUp } from "lucide-react";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function SidebarUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="h-14 rounded-lg group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent font-semibold text-sidebar-accent-foreground">
            KD
          </div>

          <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">Kush Dabade</span>

            <span className="text-muted-foreground truncate text-xs">kush@example.com</span>
          </div>

          <ChevronUp className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
