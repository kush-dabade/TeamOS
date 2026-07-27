import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { removeWorkspaceMember } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";

export function useRemoveWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, string>({
    mutationFn: (memberId) => removeWorkspaceMember(workspaceId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId),
        refetchType: "all",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
