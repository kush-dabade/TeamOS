import type { PropsWithChildren } from "react";

import { SidebarInset } from "@/components/ui/sidebar";

type AppMainProps = PropsWithChildren;

export function AppMain({ children }: AppMainProps) {
  return (
    <SidebarInset>
      {children}
    </SidebarInset>
  );
}