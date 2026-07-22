import type { ProjectStatus } from "../types";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  // The backend excludes archived projects from the default list response,
  // so status is part of the server-side query, not just a client-side filter.
  list: (workspaceId: string, status?: ProjectStatus) =>
    [...projectKeys.lists(), workspaceId, status ?? "ALL"] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
};
