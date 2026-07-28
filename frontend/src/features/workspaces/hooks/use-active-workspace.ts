import { useContext } from "react";

import { WorkspaceContext } from "../providers/workspace-provider";

/**
 * Reads the active workspace from WorkspaceProvider. Replaces
 * `useCurrentWorkspace` for feature code; `WorkspaceGuard` still uses the
 * legacy hook until it migrates in a later commit.
 */
export function useActiveWorkspace() {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error("useActiveWorkspace must be used within a WorkspaceProvider");
  }

  return context;
}
