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
import { UserAvatar } from "@/components/ux";
import { logout, useAuth } from "@/features/auth";
import { getAvatarUrl, getErrorMessage } from "@/utils";

import { ThemeToggle } from "./theme-toggle";

export function SidebarUser() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const name = user?.name ?? "Unknown User";
  const email = user?.email ?? "";
  const avatarUrl = user ? getAvatarUrl(user) : null;

  async function handleSignOut() {
    try {
      await logout();

      // Query cache isolation is owned by AuthProvider's authenticated ->
      // unauthenticated transition detector, so it also covers Better
      // Auth's cross-tab sign-out broadcast, not just this button.
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
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
              <UserAvatar name={name} image={avatarUrl} size="lg" />

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
              Workspace settings
            </DropdownMenuItem>

            <ThemeToggle />

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
