import { PanelLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

import { SidebarBrandButton } from "./sidebar-brand-button";

export function SidebarBrand() {
  const { state, toggleSidebar } = useSidebar();

  const isCollapsed = state === "collapsed";

  return (
    <div className="group flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
      <SidebarBrandButton />

      {!isCollapsed && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          className="size-8 rounded-md text-muted-foreground opacity-40 transition-all duration-200 hover:text-foreground hover:opacity-100 group-hover:opacity-100"
        >
          <PanelLeftIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}
