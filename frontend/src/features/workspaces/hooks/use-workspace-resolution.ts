import { useContext } from "react";

import { WorkspaceContext } from "../providers/workspace-provider";

/**
 * Internal — exposes workspace resolution status (loading/error/refetch)
 * alongside the raw workspace list. Consumed by WorkspaceGuard and
 * WorkspaceSwitcher, the only two things allowed to know workspaces are
 * still resolving. Feature code should use `useActiveWorkspace` instead.
 */
export function useWorkspaceResolution() {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error("useWorkspaceResolution must be used within a WorkspaceProvider");
  }

  return context;
}
