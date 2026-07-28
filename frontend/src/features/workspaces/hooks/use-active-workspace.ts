import { useWorkspaceResolution } from "./use-workspace-resolution";

/**
 * Public workspace-resolution API for feature code. WorkspaceGuard has
 * already guaranteed a resolved workspace list by the time anything below
 * it renders, so this deliberately excludes loading/error/refetch — those
 * belong exclusively to WorkspaceGuard (see use-workspace-resolution.ts).
 */
export function useActiveWorkspace() {
  const { activeWorkspace, activeWorkspaceId, workspaces, switchWorkspace } =
    useWorkspaceResolution();

  return {
    workspace: activeWorkspace,
    workspaceId: activeWorkspaceId,
    workspaces,
    switchWorkspace,
  };
}
