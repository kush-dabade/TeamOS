import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { resendInvitation } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { WorkspaceInvitation } from "../types";

export function useResendInvitation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkspaceInvitation, AppError, string>({
    mutationFn: (invitationId) => resendInvitation(workspaceId, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(workspaceId),
        refetchType: "all",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
