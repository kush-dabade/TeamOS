import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";
import { workspaceKeys } from "@/features/workspaces/lib/workspace-keys";

import { acceptInvitation } from "../api/invitations.api";
import { invitationKeys } from "../lib/invitation-keys";
import type { Invitation } from "../types";

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation<Invitation, AppError, string>({
    mutationFn: (token) => acceptInvitation(token),
    onSuccess: (invitation, token) => {
      // Accepting adds the user to the workspace, so their workspace list
      // (and that workspace's member list) is now stale.
      queryClient.invalidateQueries({ queryKey: invitationKeys.preview(token) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(invitation.workspaceId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
