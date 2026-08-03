import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { leaveWorkspace } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";

export function useLeaveWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, void>({
    mutationFn: () => leaveWorkspace(workspaceId),
    onSuccess: async () => {
      // Only the workspace list is invalidated: leaving revokes access to
      // this workspace's own members/detail queries, so eagerly refetching
      // them would just hit a guaranteed 403 for no benefit (mirrors how
      // useAcceptInvitation/useDeclineInvitation scope invalidation to only
      // what the actor's relationship to the workspace actually changed).
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.list(),
        refetchType: "all",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
