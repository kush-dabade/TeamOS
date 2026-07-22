import { AlertCircle, ChevronDown } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useCurrentWorkspace } from "@/features/workspaces";

export function WorkspaceSwitcher() {
  const { data: workspace, isLoading, isError, refetch } = useCurrentWorkspace();

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-14 items-center gap-2 rounded-lg p-2">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (isError) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="h-14 rounded-lg text-destructive transition-colors"
            onClick={() => refetch()}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <AlertCircle className="size-4" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">Unable to load workspace</span>
              <span className="text-muted-foreground truncate text-xs">Click to retry</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const name = workspace?.name ?? "Workspace";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="h-14 rounded-lg transition-colors">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-semibold">
            {name.charAt(0)}
          </div>

          <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{name}</span>

            <span className="text-muted-foreground truncate text-xs">
              {workspace?.role ?? ""}
            </span>
          </div>

          <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
