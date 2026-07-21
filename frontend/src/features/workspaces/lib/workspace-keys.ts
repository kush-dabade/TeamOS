export const workspaceKeys = {
  all: ["workspaces"] as const,
  current: () => [...workspaceKeys.all, "current"] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, "members", workspaceId] as const,
};
