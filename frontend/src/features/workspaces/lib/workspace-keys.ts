export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  detail: (workspaceId: string) => [...workspaceKeys.all, "detail", workspaceId] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, "members", workspaceId] as const,
  invitations: (workspaceId: string) => [...workspaceKeys.all, "invitations", workspaceId] as const,
};
