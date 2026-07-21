import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceMembers, type WorkspaceMember } from "../api/workspaces.api";

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery<WorkspaceMember[], AppError>({
    queryKey: ["workspaces", workspaceId ?? "", "members"] as const,
    queryFn: () => fetchWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}
