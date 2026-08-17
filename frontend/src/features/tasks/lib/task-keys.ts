export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (projectId: string) => [...taskKeys.lists(), projectId] as const,
  // Page/limit must be part of the actual query key - it's what TanStack
  // Query uses to know a page change means a different query, not just a
  // different render. `list(projectId)` above stays a valid prefix of this
  // key, so the existing create/update/delete invalidation calls (which
  // invalidate by that shorter prefix) still match every cached page.
  listPage: (projectId: string, page: number, limit: number) =>
    [...taskKeys.list(projectId), page, limit] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
};
