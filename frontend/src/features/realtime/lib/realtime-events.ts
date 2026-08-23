// Mirrors backend/src/realtime/realtime.constants.ts — the backend remains
// the single source of truth for event names. There is no shared
// package/codegen between frontend and backend, so keep this list in sync by
// hand whenever the backend's REALTIME_EVENTS changes.
export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: "notification.created",
  NOTIFICATION_READ: "notification.read",
  NOTIFICATION_READ_ALL: "notification.read_all",

  ACTIVITY_CREATED: "activity.created",

  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_ARCHIVED: "project.archived",
  PROJECT_RESTORED: "project.restored",

  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_COMPLETED: "task.completed",
  TASK_DELETED: "task.deleted",

  TASK_ASSIGNED_TO_SPRINT: "task.assigned_to_sprint",
  TASK_REMOVED_FROM_SPRINT: "task.removed_from_sprint",

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

  MEMBER_LEFT: "member.left",
  MEMBER_REMOVED: "member.removed",
  MEMBER_ROLE_CHANGED: "member.role_changed",

  OWNERSHIP_TRANSFERRED: "workspace.ownership_transferred",

  WORKSPACE_ACCESS_REVOKED: "workspace.access_revoked",
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
