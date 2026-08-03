export const searchKeys = {
  all: ["search"] as const,
  results: (workspaceId: string, query: string) =>
    [...searchKeys.all, "results", workspaceId, query] as const,
};
