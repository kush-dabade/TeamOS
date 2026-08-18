import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { CreateWorkspaceForm, useActiveWorkspace, useWorkspaceResolution } from "@/features/workspaces";

export function WorkspaceSwitcher() {
  const {
    workspace,
    workspaceId: activeWorkspaceId,
    workspaces,
    switchWorkspace,
  } = useActiveWorkspace();
  const { isLoading, isError, refetch } = useWorkspaceResolution();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
            className="h-14 rounded-lg text-destructive transition-colors group-data-[collapsible=icon]:justify-center"
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-14 rounded-lg transition-colors group-data-[collapsible=icon]:justify-center"
            >
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
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start">
            {workspaces.map((item) => (
              <DropdownMenuItem key={item.id} onSelect={() => switchWorkspace(item.id)}>
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                  {item.name.charAt(0)}
                </div>

                <span className="min-w-0 flex-1 truncate">{item.name}</span>

                {item.id === activeWorkspaceId && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setIsCreateOpen(true);
              }}
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                <Plus className="size-3.5" />
              </div>

              <span className="min-w-0 flex-1 truncate">Create workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="gap-6 p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Create a separate workspace to organize a different team&apos;s projects and tasks.
            </DialogDescription>
          </DialogHeader>

          <CreateWorkspaceForm onSuccess={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
