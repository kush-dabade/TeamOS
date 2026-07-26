import { ChevronUp, LogOut, Settings, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { logout, useAuth } from "@/features/auth";

import { ThemeToggle } from "./theme-toggle";

export function SidebarUser() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const name = user?.name ?? "Unknown User";
  const email = user?.email ?? "";

  async function handleSignOut() {
    try {
      await logout();

      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-14 rounded-lg group-data-[collapsible=icon]:justify-center"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent font-semibold text-sidebar-accent-foreground">
                {getInitials(name)}
              </div>

              <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">{name}</span>

                <span className="text-muted-foreground truncate text-xs">{email}</span>
              </div>

              <ChevronUp className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuItem onSelect={() => navigate("/profile")}>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => navigate("/workspace/settings")}>
              <Settings className="size-4" />
              Workspace Settings
            </DropdownMenuItem>

            <ThemeToggle />

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
              <LogOut className="size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}
