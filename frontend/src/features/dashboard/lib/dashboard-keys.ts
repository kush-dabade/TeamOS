export const dashboardKeys = {
  all: ["dashboard"] as const,
  recentActivity: (workspaceId: string) => [...dashboardKeys.all, "recent-activity", workspaceId] as const,
};
