export const ROOM_PREFIXES = {
  WORKSPACE: "workspace",
  USER: "user",
} as const;

export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: "notification.created",

  ACTIVITY_CREATED: "activity.created",

  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_ARCHIVED: "project.archived",
  PROJECT_RESTORED: "project.restored",

  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_DELETED: "task.deleted",

  COMMENT_CREATED: "comment.created",
  COMMENT_UPDATED: "comment.updated",
  COMMENT_DELETED: "comment.deleted",

  SPRINT_CREATED: "sprint.created",
  SPRINT_UPDATED: "sprint.updated",
  SPRINT_STARTED: "sprint.started",
  SPRINT_COMPLETED: "sprint.completed",

  ATTACHMENT_UPLOADED: "attachment.uploaded",
  ATTACHMENT_DELETED: "attachment.deleted",

  INVITATION_CREATED: "invitation.created",
  INVITATION_ACCEPTED: "invitation.accepted",
  INVITATION_DECLINED: "invitation.declined",
} as const;

export type RealtimeEvent =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];