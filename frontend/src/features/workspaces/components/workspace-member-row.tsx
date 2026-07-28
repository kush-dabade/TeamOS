import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useRemoveWorkspaceMember } from "../hooks/use-remove-workspace-member";
import { useUpdateWorkspaceMemberRole } from "../hooks/use-update-workspace-member-role";
import { ROLE_LABELS, canManageMember, getAssignableRoles } from "../lib/workspace-roles";
import type { WorkspaceMember, WorkspaceRole } from "../types";

import { WorkspaceRoleBadge } from "./workspace-role-badge";

interface WorkspaceMemberRowProps {
  workspaceId: string;
  member: WorkspaceMember;
  actorRole: WorkspaceRole;
}

export function WorkspaceMemberRow({ workspaceId, member, actorRole }: WorkspaceMemberRowProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const updateRole = useUpdateWorkspaceMemberRole(workspaceId);
  const removeMember = useRemoveWorkspaceMember(workspaceId);

  const canManage = canManageMember(actorRole, member.role);
  const assignableRoles = getAssignableRoles(actorRole);

  async function handleRoleChange(role: WorkspaceRole) {
    if (role === member.role) {
      return;
    }

    try {
      await updateRole.mutateAsync({ memberId: member.id, role });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  async function handleConfirmRemove() {
    try {
      await removeMember.mutateAsync(member.id);
      setIsRemoveDialogOpen(false);
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{member.name}</span>
          <span className="truncate text-xs text-muted-foreground">{member.email}</span>
        </div>
      </td>

      <td className="px-3 py-2">
        <WorkspaceRoleBadge role={member.role} />
      </td>

      <td className="px-3 py-2 text-right">
        {canManage ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${member.name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Change role</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={member.role}
                  onValueChange={(value) => handleRoleChange(value as WorkspaceRole)}
                >
                  {assignableRoles.map((role) => (
                    <DropdownMenuRadioItem
                      key={role}
                      value={role}
                      disabled={updateRole.isPending}
                    >
                      {ROLE_LABELS[role]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    setIsRemoveDialogOpen(true);
                  }}
                >
                  Remove member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove {member.name}?</DialogTitle>
                  <DialogDescription>
                    They will immediately lose access to this workspace. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleConfirmRemove}
                    disabled={removeMember.isPending}
                  >
                    {removeMember.isPending ? "Removing..." : "Remove"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </td>
    </tr>
  );
}
