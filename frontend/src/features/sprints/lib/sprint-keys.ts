export const sprintKeys = {
  all: ["sprints"] as const,
  lists: () => [...sprintKeys.all, "list"] as const,
  list: (projectId: string) => [...sprintKeys.lists(), projectId] as const,
  details: () => [...sprintKeys.all, "detail"] as const,
  detail: (sprintId: string) => [...sprintKeys.details(), sprintId] as const,
  tasks: (sprintId: string) => [...sprintKeys.detail(sprintId), "tasks"] as const,
};
