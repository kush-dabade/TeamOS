import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceInvitations } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { WorkspaceInvitation } from "../types";

export function useWorkspaceInvitations(workspaceId: string, enabled: boolean) {
  return useQuery<WorkspaceInvitation[], AppError>({
    queryKey: workspaceKeys.invitations(workspaceId),
    queryFn: () => fetchWorkspaceInvitations(workspaceId),
    enabled,
  });
}
