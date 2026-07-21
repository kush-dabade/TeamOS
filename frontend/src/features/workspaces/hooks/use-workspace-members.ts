import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceMembers, type WorkspaceMember } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery<WorkspaceMember[], AppError>({
    queryKey: workspaceKeys.members(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}
