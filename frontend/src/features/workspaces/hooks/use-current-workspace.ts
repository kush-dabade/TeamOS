import { useWorkspaceList } from "./use-workspace-list";

/**
 * Legacy "current workspace" hook — still powers `WorkspaceGuard` and
 * `WorkspaceSwitcher` until they migrate to `useActiveWorkspace`.
 *
 * Delegates to `useWorkspaceList()` instead of running its own query so it
 * shares a cache entry (and an in-flight request) with `WorkspaceProvider`
 * rather than issuing a second, redundant `/workspaces` fetch.
 */
export function useCurrentWorkspace() {
  const workspacesQuery = useWorkspaceList();

  return {
    data: workspacesQuery.data ? (workspacesQuery.data[0] ?? null) : undefined,
    isPending: workspacesQuery.isPending,
    isLoading: workspacesQuery.isLoading,
    isError: workspacesQuery.isError,
    error: workspacesQuery.error,
    refetch: workspacesQuery.refetch,
  };
}
