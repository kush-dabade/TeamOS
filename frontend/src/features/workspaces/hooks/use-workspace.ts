import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspace } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { Workspace } from "../types";

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery<Workspace, AppError>({
    queryKey: workspaceKeys.detail(workspaceId ?? ""),
    queryFn: () => fetchWorkspace(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}
