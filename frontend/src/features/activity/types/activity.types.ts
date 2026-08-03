// Mirrors the backend `ActivityType` enum (backend/src/generated/prisma/enums.ts).
export type ActivityType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_ARCHIVED"
  | "TASK_CREATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMPLETED"
  | "TASK_DELETED"
  | "TASK_ASSIGNED_TO_SPRINT"
  | "TASK_REMOVED_FROM_SPRINT"
  | "COMMENT_CREATED"
  | "COMMENT_UPDATED"
  | "COMMENT_DELETED"
  | "ATTACHMENT_UPLOADED"
  | "ATTACHMENT_DELETED"
  | "USER_INVITED"
  | "INVITATION_ACCEPTED"
  | "INVITATION_DECLINED"
  | "MEMBER_LEFT"
  | "SPRINT_CREATED"
  | "SPRINT_UPDATED"
  | "SPRINT_STARTED"
  | "SPRINT_COMPLETED";

// Mirrors the backend `ActivityEntityType` enum.
export type ActivityEntityType =
  "PROJECT" | "TASK" | "COMMENT" | "ATTACHMENT" | "SPRINT" | "INVITATION" | "MEMBER";

export interface ActivityActor {
  id: string;
  name: string;
  image: string | null;
}

// Shaped to the backend `ActivityResponse` contract. `metadata` is
// intentionally untyped (as the backend types it) - consumers read only the
// fields they need per `type`. `createdAt` is the wire-serialized ISO string.
export interface Activity {
  id: string;
  type: ActivityType;
  entityType: ActivityEntityType;
  entityId: string;
  metadata: Record<string, unknown> | null;
  actor: ActivityActor;
  createdAt: string;
}
