import { PanelLeftIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

import { SidebarBrandButton } from "./sidebar-brand-button";

export function SidebarBrand() {
  const { state, toggleSidebar } = useSidebar();

  const isCollapsed = state === "collapsed";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <SidebarBrandButton />

        {!isCollapsed && (
          <Link to="/dashboard" className="truncate text-base font-semibold tracking-tight">
            TeamOS
          </Link>
        )}
      </div>

      {!isCollapsed && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          className="size-8 rounded-md"
        >
          <PanelLeftIcon className="size-5" />
        </Button>
      )}
    </div>
  );
}
