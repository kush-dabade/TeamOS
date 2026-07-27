import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { cancelInvitation } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";

export function useCancelInvitation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, string>({
    mutationFn: (invitationId) => cancelInvitation(workspaceId, invitationId),
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
