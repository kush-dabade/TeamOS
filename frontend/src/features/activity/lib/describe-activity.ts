import type { Activity } from "../types";

interface ActivityDescription {
  action: string;
  entity: string | null;
}

// Frontend-generated description for the activity types the UI explicitly
// knows how to phrase. Every other type gets a neutral fallback so a new
// backend enum value never breaks a feed.
export function describeActivity(activity: Activity): ActivityDescription {
  const metadata = activity.metadata ?? {};
  const taskTitle = typeof metadata.taskTitle === "string" ? metadata.taskTitle : null;
  const projectName = typeof metadata.projectName === "string" ? metadata.projectName : null;

  switch (activity.type) {
    case "TASK_CREATED":
      return { action: "created a task", entity: taskTitle };
    case "TASK_STATUS_CHANGED":
      return { action: "updated a task", entity: taskTitle };
    case "TASK_COMPLETED":
      return { action: "completed a task", entity: taskTitle };
    case "TASK_DELETED":
      return { action: "deleted a task", entity: taskTitle };
    case "PROJECT_CREATED":
      return { action: "created a project", entity: projectName };
    case "PROJECT_UPDATED":
      return { action: "updated a project", entity: projectName };
    case "PROJECT_ARCHIVED":
      return { action: "archived a project", entity: projectName };
    case "COMMENT_CREATED":
      return { action: "left a comment", entity: null };
    case "COMMENT_UPDATED":
      return { action: "edited a comment", entity: null };
    case "COMMENT_DELETED":
      return { action: "deleted a comment", entity: null };
    default:
      return { action: "updated an item", entity: null };
  }
}
