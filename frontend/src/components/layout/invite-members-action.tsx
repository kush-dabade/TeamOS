import { useState } from "react";
import { UserPlus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useActiveWorkspace, WorkspaceInviteForm } from "@/features/workspaces";

// Same OWNER/ADMIN rule WorkspaceMembersCard (Settings) already gates its
// own Invite action on - not a new capability, just a second entry point to
// the same existing WorkspaceInviteForm/useCreateInvitation flow. Hiding the
// item is UX only: the backend remains the source of truth for who can
// actually invite.
export function InviteMembersAction() {
  const { workspace } = useActiveWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  const canInvite = workspace?.role === "OWNER" || workspace?.role === "ADMIN";

  if (!workspace || !canInvite) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton type="button" onClick={() => setIsOpen(true)}>
          <UserPlus className="size-4 shrink-0" />
          <span className="truncate">Invite members</span>
        </SidebarMenuButton>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="gap-6 p-6 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>
                They&apos;ll receive an email invitation to join {workspace.name} with the role
                you choose below.
              </DialogDescription>
            </DialogHeader>

            <WorkspaceInviteForm
              workspaceId={workspace.id}
              actorRole={workspace.role}
              onSuccess={() => setIsOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
