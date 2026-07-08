import { useState } from "react";
import { Layers3, PanelLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/utils";

export function SidebarBrandButton() {
  const { state, toggleSidebar } = useSidebar();

  const [hovered, setHovered] = useState(false);

  const isCollapsed = state === "collapsed";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="TeamOS"
      onClick={() => {
        if (isCollapsed) {
          toggleSidebar();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="size-8 rounded-md"
    >
      <div className="relative size-5">
        <Layers3
          className={cn(
            "absolute inset-0 size-5 transition-all duration-150 ease-out",
            isCollapsed && hovered ? "scale-90 opacity-0" : "scale-100 opacity-100",
          )}
        />

        <PanelLeftIcon
          className={cn(
            "absolute inset-0 size-5 transition-all duration-150 ease-out",
            isCollapsed && hovered ? "scale-100 opacity-100" : "scale-90 opacity-0",
          )}
        />
      </div>
    </Button>
  );
}
