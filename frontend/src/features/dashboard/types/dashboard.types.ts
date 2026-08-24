import type { ProjectStatus } from "@/features/projects/types";

export type AttentionItemKind = "OVERDUE_TASK" | "PENDING_REVIEW";

export type AttentionEntityType = "TASK";

export interface WorkspaceAttentionItem {
  id: string;
  kind: AttentionItemKind;
  title: string;
  context: string;
  occurredAt: string;
  entityType: AttentionEntityType;
  entityId: string;
}

// Mirrors the backend `ActivityType` enum. The Recent Activity feed renders
// task-, project-, and comment-based types explicitly and falls back to a
// neutral description for the rest, so new enum values never break the feed.
export type ActivityType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_ARCHIVED"
  | "PROJECT_RESTORED"
  | "TASK_CREATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMPLETED"
  | "TASK_DELETED"
  | "TASK_ASSIGNED_TO_SPRINT"
  | "TASK_REMOVED_FROM_SPRINT"
  | "COMMENT_CREATED"
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

// Shaped to the backend `ActivityResponse` contract so the `useRecentActivity`
// boundary can later map an API payload without changing consumers. `metadata`
// is intentionally untyped (as the backend types it) — the row reads only the
// fields it needs per `type`. `createdAt` is the wire-serialized ISO string.
export interface RecentActivityItem {
  id: string;
  type: ActivityType;
  entityType: ActivityEntityType;
  entityId: string;
  metadata: Record<string, unknown> | null;
  actor: ActivityActor;
  createdAt: string;
}

export interface ContinueWorkingItem {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  lastActivityAt: string;
}
