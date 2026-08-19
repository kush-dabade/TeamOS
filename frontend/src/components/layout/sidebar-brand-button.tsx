import { useState } from "react";
import { Layers3, PanelLeftIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/utils";

export function SidebarBrandButton() {
  const { state, toggleSidebar } = useSidebar();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState(false);

  const isCollapsed = state === "collapsed";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        if (isCollapsed) {
          toggleSidebar();
          return;
        }

        navigate("/dashboard");
      }}
      aria-label={isCollapsed ? "Expand sidebar" : "TeamOS"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "h-10 flex-1 justify-start gap-3 rounded-lg px-2",
        isCollapsed && "size-10 justify-center px-0",
      )}
    >
      <div className="relative size-5 shrink-0">
        <Layers3
          className={cn(
            "absolute inset-0 size-5 transition-all duration-200 ease-out",
            isCollapsed && hovered ? "scale-90 opacity-0" : "scale-100 opacity-100",
          )}
        />

        <PanelLeftIcon
          className={cn(
            "absolute inset-0 size-5 transition-all duration-200 ease-out",
            isCollapsed && hovered ? "scale-100 opacity-100" : "scale-90 opacity-0",
          )}
        />
      </div>

      {!isCollapsed && (
        <span className="truncate text-base font-bold tracking-tight">TeamOS</span>
      )}
    </Button>
  );
}
