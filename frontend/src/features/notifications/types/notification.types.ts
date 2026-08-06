// Mirrors the backend `NotificationType` enum (backend/src/generated/prisma/enums.ts).
export type NotificationType =
  | "INVITATION_RECEIVED"
  | "TASK_ASSIGNED"
  | "COMMENT_ON_ASSIGNED_TASK"
  | "COMMENT_MENTIONED";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}
