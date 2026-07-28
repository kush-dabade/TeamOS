import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaces } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { Workspace } from "../types";

/**
 * Fetches every workspace the signed-in user belongs to. Consumed by
 * WorkspaceProvider to resolve the active workspace — not intended to be
 * called directly by feature code (use `useActiveWorkspace` instead).
 */
export function useWorkspaceList() {
  return useQuery<Workspace[], AppError>({
    queryKey: workspaceKeys.list(),
    queryFn: fetchWorkspaces,
  });
}
