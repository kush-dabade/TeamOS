import type { Activity } from "../types";

interface ActivityDescription {
  action: string;
  entity: string | null;
}

function getString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Frontend-generated description for every backend `ActivityType`. Wording is
// kept short (verb + noun, e.g. "created task") so a row reads as a scannable
// label rather than a sentence - anything not explicitly mapped here falls
// back to a neutral phrase so a new backend enum value never breaks a feed.
export function describeActivity(activity: Activity): ActivityDescription {
  const metadata = activity.metadata ?? {};
  const taskTitle = getString(metadata, "taskTitle");
  const projectName = getString(metadata, "projectName");
  const sprintName = getString(metadata, "sprintName") ?? getString(metadata, "newName");
  const attachmentName = getString(metadata, "attachmentName");
  const invitedEmail = getString(metadata, "invitedEmail");
  const workspaceName = getString(metadata, "workspaceName");

  switch (activity.type) {
    case "TASK_CREATED":
      return { action: "created task", entity: taskTitle };
    case "TASK_STATUS_CHANGED":
      return { action: "updated status", entity: taskTitle };
    case "TASK_COMPLETED":
      return { action: "completed task", entity: taskTitle };
    case "TASK_DELETED":
      return { action: "deleted task", entity: taskTitle };
    case "TASK_ASSIGNED_TO_SPRINT":
      return { action: "added to sprint", entity: taskTitle };
    case "TASK_REMOVED_FROM_SPRINT":
      return { action: "removed from sprint", entity: taskTitle };
    case "PROJECT_CREATED":
      return { action: "created project", entity: projectName };
    case "PROJECT_UPDATED":
      return { action: "updated project", entity: projectName };
    case "PROJECT_ARCHIVED":
      return { action: "archived project", entity: projectName };
    case "COMMENT_CREATED":
      return { action: "commented", entity: taskTitle };
    case "COMMENT_UPDATED":
      return { action: "edited comment", entity: taskTitle };
    case "COMMENT_DELETED":
      return { action: "deleted comment", entity: taskTitle };
    case "ATTACHMENT_UPLOADED":
      return { action: "added attachment", entity: attachmentName };
    case "ATTACHMENT_DELETED":
      return { action: "deleted attachment", entity: attachmentName };
    case "USER_INVITED":
      return { action: "invited member", entity: invitedEmail };
    case "INVITATION_ACCEPTED":
      return { action: "accepted invitation", entity: invitedEmail };
    case "INVITATION_DECLINED":
      return { action: "declined invitation", entity: invitedEmail };
    case "MEMBER_LEFT":
      return { action: "left workspace", entity: workspaceName };
    case "SPRINT_CREATED":
      return { action: "created sprint", entity: sprintName };
    case "SPRINT_UPDATED":
      return { action: "updated sprint", entity: sprintName };
    case "SPRINT_STARTED":
      return { action: "started sprint", entity: sprintName };
    case "SPRINT_COMPLETED":
      return { action: "completed sprint", entity: sprintName };
    default:
      return { action: "updated an item", entity: null };
  }
}
