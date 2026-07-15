import type { PropsWithChildren } from "react";

import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/utils";

import { AppHeader } from "./app-header";

type AppMainProps = PropsWithChildren;

export function AppMain({ children }: AppMainProps) {
  const { state } = useSidebar();

  return (
    <SidebarInset
      className={cn(
        "h-screen bg-muted/20 py-4 pr-4 transition-[padding] duration-200 md:py-5 md:pr-5",
        state === "collapsed" ? "pl-2" : "pl-3 md:pl-4",
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-background shadow-sm">
        <AppHeader />

        <main className="min-h-0 flex-1 overflow-y-auto pb-4">{children}</main>
      </div>
    </SidebarInset>
  );
}
