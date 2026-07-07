import { Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function SidebarBrand() {
  return (
    <div className="flex items-center justify-between">
      <Link
        to="/dashboard"
        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent"
      >
        <Layers3 className="size-5 shrink-0 text-primary" />

        <span className="truncate text-base font-semibold group-data-[collapsible=icon]:hidden">
          TeamOS
        </span>
      </Link>

      <SidebarTrigger className="group-data-[collapsible=icon]:hidden opacity-60 transition-opacity hover:opacity-100" />
    </div>
  );
}
