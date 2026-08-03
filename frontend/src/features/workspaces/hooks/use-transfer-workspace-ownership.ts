import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { transferWorkspaceOwnership } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { WorkspaceOwnershipTransfer } from "../types";

export function useTransferWorkspaceOwnership(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkspaceOwnershipTransfer, AppError, string>({
    mutationFn: (memberId) => transferWorkspaceOwnership(workspaceId, memberId),
    onSuccess: async () => {
      // The previous owner's and new owner's roles both changed, and the
      // acting user's own role (surfaced by both the list and detail
      // queries, e.g. in the workspace switcher and settings page) may now
      // be stale, so all three are invalidated. Invitations are unaffected
      // by an ownership transfer and are intentionally left alone.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.list(),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(workspaceId),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.members(workspaceId),
          refetchType: "all",
        }),
      ]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
