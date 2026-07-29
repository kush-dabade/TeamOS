import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/utils/formatDate";

import { useCancelInvitation } from "../hooks/use-cancel-invitation";
import { useResendInvitation } from "../hooks/use-resend-invitation";
import type { WorkspaceInvitation } from "../types";

import { WorkspaceInvitationStatusBadge } from "./workspace-invitation-status-badge";
import { WorkspaceRoleBadge } from "./workspace-role-badge";

interface WorkspaceInvitationRowProps {
  workspaceId: string;
  invitation: WorkspaceInvitation;
}

export function WorkspaceInvitationRow({ workspaceId, invitation }: WorkspaceInvitationRowProps) {
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const resendInvitation = useResendInvitation(workspaceId);
  const cancelInvitation = useCancelInvitation(workspaceId);

  async function handleResend() {
    try {
      await resendInvitation.mutateAsync(invitation.id);
      toast.success("Invitation resent.");
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  async function handleConfirmCancel() {
    try {
      await cancelInvitation.mutateAsync(invitation.id);
      setIsCancelDialogOpen(false);
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="truncate px-3 py-2">
        <span className="text-sm">{invitation.email}</span>
      </td>

      <td className="px-3 py-2">
        <WorkspaceRoleBadge role={invitation.role} />
      </td>

      <td className="px-3 py-2">
        <WorkspaceInvitationStatusBadge />
      </td>

      <td className="px-3 py-2">
        <span className="text-sm text-muted-foreground">{formatDate(invitation.expiresAt)}</span>
      </td>

      <td className="px-3 py-2 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for invitation to ${invitation.email}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={resendInvitation.isPending}
              onSelect={() => {
                void handleResend();
              }}
            >
              {resendInvitation.isPending ? "Resending..." : "Resend"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                setIsCancelDialogOpen(true);
              }}
            >
              Cancel invitation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel invitation to {invitation.email}?</DialogTitle>
              <DialogDescription>
                They will no longer be able to join this workspace with this invitation. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={cancelInvitation.isPending}
              >
                {cancelInvitation.isPending ? "Cancelling..." : "Cancel Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
