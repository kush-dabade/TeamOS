import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaces } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import type { Workspace } from "../types";

/**
 * TeamOS does not yet have workspace switching UI - every user's workspace
 * list is rendered as a single fixed entry (see WorkspaceSwitcher). Until
 * that exists, "current workspace" is simply the first workspace returned
 * for the signed-in user.
 */
export function useCurrentWorkspace() {
  return useQuery<Workspace | null, AppError>({
    queryKey: workspaceKeys.current(),
    queryFn: async () => {
      const workspaces = await fetchWorkspaces();

      return workspaces[0] ?? null;
    },
  });
}
