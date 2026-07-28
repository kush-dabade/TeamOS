import { useContext } from "react";

import { WorkspaceContext } from "../providers/workspace-provider";

/**
 * Reads the active workspace from WorkspaceProvider. Not yet consumed
 * anywhere — this replaces `useCurrentWorkspace` once callers migrate.
 */
export function useActiveWorkspace() {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error("useActiveWorkspace must be used within a WorkspaceProvider");
  }

  return context;
}
