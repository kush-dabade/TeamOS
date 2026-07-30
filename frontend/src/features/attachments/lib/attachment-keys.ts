export const attachmentKeys = {
  all: ["attachments"] as const,
  lists: () => [...attachmentKeys.all, "list"] as const,
  list: (taskId: string) => [...attachmentKeys.lists(), taskId] as const,
};
