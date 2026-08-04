import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaces } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { Workspace } from "../types";

/**
 * Fetches every workspace the signed-in user belongs to. Consumed by
 * WorkspaceProvider to resolve the active workspace — not intended to be
 * called directly by feature code (use `useActiveWorkspace` instead).
 *
 * `enabled` defaults to true (WorkspaceProvider's existing usage is
 * unaffected) — RealtimeProvider passes `isAuthenticated` explicitly, since
 * it's mounted above the router and would otherwise fire this query while
 * logged out.
 */
export function useWorkspaceList(enabled = true) {
  return useQuery<Workspace[], AppError>({
    queryKey: workspaceKeys.list(),
    queryFn: fetchWorkspaces,
    enabled,
  });
}
