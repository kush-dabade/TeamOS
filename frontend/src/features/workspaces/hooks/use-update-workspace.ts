import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { updateWorkspace, type UpdateWorkspaceInput } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { Workspace } from "../types";

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<Workspace, AppError, UpdateWorkspaceInput>({
    mutationFn: (input) => updateWorkspace(workspaceId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspaceId),
        refetchType: "all",
      });

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
