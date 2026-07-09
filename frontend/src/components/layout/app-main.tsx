import type { PropsWithChildren } from "react";

import { cn } from "@/utils";
import { SidebarInset, useSidebar } from "@/components/ui/sidebar";

import { AppHeader } from "./app-header";

type AppMainProps = PropsWithChildren;

export function AppMain({ children }: AppMainProps) {
  const { state } = useSidebar();

  return (
    <SidebarInset
      className={cn(
        "h-screen bg-muted/20 py-5 pr-5 transition-all duration-200 md:py-6 md:pr-6",
        state === "collapsed" ? "pl-2 md:pl-2" : "pl-3 md:pl-4",
      )}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl bg-background shadow-sm">
        <AppHeader />

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </SidebarInset>
  );
}
