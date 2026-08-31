import { SidebarTrigger } from "@/components/ui/sidebar";
import { DemoIndicator } from "@/features/demo";

import { HeaderActions } from "./header-actions";
import { HeaderNavigation } from "./header-navigation";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />

        <HeaderNavigation />
      </div>

      <div className="flex items-center gap-3">
        <DemoIndicator />
        <HeaderActions />
      </div>
    </header>
  );
}
