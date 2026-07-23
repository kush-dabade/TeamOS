import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { createWorkspace, type CreateWorkspaceInput } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, CreateWorkspaceInput>({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      // Awaited (and forced via refetchType) so the cache already holds the
      // new workspace by the time WorkspaceGuard re-evaluates on navigation.
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.current(),
        refetchType: "all",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
