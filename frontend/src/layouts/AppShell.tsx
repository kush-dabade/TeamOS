import { Outlet } from "react-router-dom";

import { AppMain } from "@/components/layout/app-main";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppShell() {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />

      <AppMain>
        <Outlet />
      </AppMain>
    </SidebarProvider>
  );
}