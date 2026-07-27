import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { updateWorkspaceMemberRole } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { WorkspaceMember, WorkspaceRole } from "../types";

interface UpdateWorkspaceMemberRoleInput {
  memberId: string;
  role: WorkspaceRole;
}

export function useUpdateWorkspaceMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkspaceMember, AppError, UpdateWorkspaceMemberRoleInput>({
    mutationFn: ({ memberId, role }) => updateWorkspaceMemberRole(workspaceId, memberId, role),
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
