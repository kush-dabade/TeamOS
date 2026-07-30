export const commentKeys = {
  all: ["comments"] as const,
  lists: () => [...commentKeys.all, "list"] as const,
  list: (taskId: string) => [...commentKeys.lists(), taskId] as const,
};
