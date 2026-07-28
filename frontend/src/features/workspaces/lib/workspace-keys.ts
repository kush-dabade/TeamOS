export const workspaceKeys = {
  all: ["workspaces"] as const,
  // Superseded by `list()`. Kept until every consumer migrates off
  // `useCurrentWorkspace` (see WorkspaceProvider) so existing queries keep working.
  current: () => [...workspaceKeys.all, "current"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  detail: (workspaceId: string) => [...workspaceKeys.all, "detail", workspaceId] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, "members", workspaceId] as const,
  invitations: (workspaceId: string) => [...workspaceKeys.all, "invitations", workspaceId] as const,
};
