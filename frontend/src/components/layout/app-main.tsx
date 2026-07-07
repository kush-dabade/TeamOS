import type { PropsWithChildren } from "react";

import { SidebarInset } from "@/components/ui/sidebar";

import { AppHeader } from "./app-header";

type AppMainProps = PropsWithChildren;

export function AppMain({ children }: AppMainProps) {
  return (
    <SidebarInset className="h-screen overflow-hidden">
      <AppHeader />

      <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">{children}</div>
    </SidebarInset>
  );
}
