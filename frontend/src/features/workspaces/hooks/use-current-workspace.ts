import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaces, type Workspace } from "../api/workspaces.api";

const CURRENT_WORKSPACE_QUERY_KEY = ["workspaces", "current"] as const;

/**
 * TeamOS does not yet have workspace switching UI - every user's workspace
 * list is rendered as a single fixed entry (see WorkspaceSwitcher). Until
 * that exists, "current workspace" is simply the first workspace returned
 * for the signed-in user.
 */
export function useCurrentWorkspace() {
  return useQuery<Workspace | null, AppError>({
    queryKey: CURRENT_WORKSPACE_QUERY_KEY,
    queryFn: async () => {
      const workspaces = await fetchWorkspaces();

      return workspaces[0] ?? null;
    },
  });
}
