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
  // Separate branch, not a project-scoped list - workspaceList(workspaceId)
  // caches the complete cross-project task set fetchAllWorkspaceTasks
  // assembles internally in use-tasks.ts, keyed by workspace rather than
  // page, since callers consume it as one flat collection, not a page at a
  // time. workspaceLists() (no id) exists solely as the invalidation prefix
  // mutation hooks use, since none of them know which workspace's cache to
  // target precisely without threading workspaceId through their variables.
  workspaceLists: () => [...taskKeys.all, "workspace-list"] as const,
  workspaceList: (workspaceId: string) => [...taskKeys.workspaceLists(), workspaceId] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
};
