import { useState } from "react";
import { toast } from "sonner";

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
      <td className="px-3 py-2">
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
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={resendInvitation.isPending}
          >
            {resendInvitation.isPending ? "Resending..." : "Resend"}
          </Button>

          <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogTrigger>
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
        </div>
      </td>
    </tr>
  );
}
