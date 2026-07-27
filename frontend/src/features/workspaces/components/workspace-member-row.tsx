import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    await updateRole.mutateAsync({ memberId: member.id, role });
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
        <div className="flex flex-col">
          <span className="text-sm font-medium">{member.name}</span>
          <span className="text-xs text-muted-foreground">{member.email}</span>
        </div>
      </td>

      <td className="px-3 py-2">
        {canManage ? (
          <Select
            value={member.role}
            onValueChange={(value) => handleRoleChange(value as WorkspaceRole)}
            disabled={updateRole.isPending}
          >
            <SelectTrigger size="sm" aria-label={`Change role for ${member.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {assignableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <WorkspaceRoleBadge role={member.role} />
        )}
      </td>

      <td className="px-3 py-2 text-right">
        {canManage ? (
          <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                Remove
              </Button>
            </DialogTrigger>
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
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
