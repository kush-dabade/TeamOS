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
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.list(),
        refetchType: "all",
      });

      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId),
        refetchType: "all",
      });

      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspaceId),
        refetchType: "all",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
