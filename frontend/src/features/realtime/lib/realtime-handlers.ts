import type { QueryClient } from "@tanstack/react-query";

import { notificationKeys } from "@/features/notifications";
import { commentKeys } from "@/features/comments";
import { attachmentKeys } from "@/features/attachments";
import { activityKeys } from "@/features/activity";
import type { ActivityEntityType } from "@/features/activity";
import { taskKeys } from "@/features/tasks";
import { projectKeys } from "@/features/projects";
import { workspaceKeys } from "@/features/workspaces";

import { REALTIME_EVENTS, type RealtimeEvent } from "./realtime-events";

export type RealtimeHandler = (payload: unknown, queryClient: QueryClient) => void;

// notification.created/read/read_all all affect the same two queries — the
// header badge's unread count and the popover's list — regardless of which
// single notification changed, since neither query is keyed per-notification.
// The payload is intentionally unused: emitToUser already scoped the event to
// the recipient's own room server-side, so there's nothing left to check
// before invalidating.
function invalidateNotificationQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
  queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
}

// Comment payload shapes, per backend/src/modules/comments/comments.service.ts.
// created/updated carry the full comment; deleted only carries the id — none
// of that content is used here, only taskId, since invalidate-only means the
// refetch (not this payload) is what repopulates the cache.
interface CommentCreatedOrUpdatedPayload {
  taskId: string;
}
interface CommentDeletedPayload {
  taskId: string;
}

// Payloads arrive over the network as `unknown` — a future backend release
// could rename/omit a field, and a bare `payload as X` cast would let a
// nested property access (e.g. `task.projectId`) throw inside the socket
// listener. Each guard below checks only the fields that handler actually
// reads; a malformed payload just makes the handler return early and skip
// that one invalidation, rather than crashing the listener.
function isCommentCreatedOrUpdatedPayload(
  payload: unknown,
): payload is CommentCreatedOrUpdatedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "taskId" in payload &&
    typeof payload.taskId === "string"
  );
}

function isCommentDeletedPayload(payload: unknown): payload is CommentDeletedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "taskId" in payload &&
    typeof payload.taskId === "string"
  );
}

function invalidateTaskComments(taskId: string, queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
}

// Attachment payload shapes, per backend/src/modules/attachment/attachment.service.ts.
interface AttachmentUploadedOrDeletedPayload {
  taskId: string;
}

function isAttachmentPayload(payload: unknown): payload is AttachmentUploadedOrDeletedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "taskId" in payload &&
    typeof payload.taskId === "string"
  );
}

function invalidateTaskAttachments(taskId: string, queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
}

// Activity payload shape, per backend/src/modules/activity/activity.service.ts.
// entityType/entityId identify which task's or project's activity feed this
// belongs to — activityKeys is keyed per-entity, so this is the only key that
// needs invalidating. Every comment/attachment mutation already emits its own
// comment.*/attachment.* event (handled above) *and* a separate
// activity.created event for the resulting Activity row — invalidating
// activityKeys from this handler alone is enough; doing it again from the
// comment/attachment handlers above would be a redundant, unnecessary
// invalidation of the same feed.
interface ActivityCreatedPayload {
  workspaceId: string;
  activity: {
    entityType: ActivityEntityType;
    entityId: string;
  };
}

function isActivityCreatedPayload(payload: unknown): payload is ActivityCreatedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "workspaceId" in payload &&
    typeof payload.workspaceId === "string" &&
    "activity" in payload &&
    typeof payload.activity === "object" &&
    payload.activity !== null &&
    "entityType" in payload.activity &&
    typeof payload.activity.entityType === "string" &&
    "entityId" in payload.activity &&
    typeof payload.activity.entityId === "string"
  );
}

// Task payload shapes, per backend/src/modules/task/task.service.ts. All four
// carry the full task (workspaceId + task), so projectId/id are always
// available without a second lookup.
interface TaskEventPayload {
  task: { id: string; projectId: string };
}

function isTaskEventPayload(payload: unknown): payload is TaskEventPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "task" in payload &&
    typeof payload.task === "object" &&
    payload.task !== null &&
    "id" in payload.task &&
    typeof payload.task.id === "string" &&
    "projectId" in payload.task &&
    typeof payload.task.projectId === "string"
  );
}

function invalidateTask(taskId: string, projectId: string, queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
  queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
}

// task.assigned_to_sprint/removed_from_sprint, per
// backend/src/modules/sprint-task/sprint-task.service.ts, carry projectId at
// the payload's top level (not nested under task) plus a partial task object
// with just id/sprintId. There is currently no dedicated Sprints frontend
// feature/query-key factory (Sprints has no route or feature module yet —
// confirmed absent from frontend/src/features), so these two events only
// invalidate the Task queries that actually exist and actually show
// sprintId (TaskWorkspacePage, TasksPage) — there is nothing sprint-specific
// to invalidate today. Revisit once a Sprints feature module exists.
interface SprintTaskEventPayload {
  projectId: string;
  task: { id: string };
}

function isSprintTaskEventPayload(payload: unknown): payload is SprintTaskEventPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "projectId" in payload &&
    typeof payload.projectId === "string" &&
    "task" in payload &&
    typeof payload.task === "object" &&
    payload.task !== null &&
    "id" in payload.task &&
    typeof payload.task.id === "string"
  );
}

// Project payload shapes, per backend/src/modules/project/project.service.ts.
interface ProjectEventPayload {
  project: { id: string };
}

function isProjectEventPayload(payload: unknown): payload is ProjectEventPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "project" in payload &&
    typeof payload.project === "object" &&
    payload.project !== null &&
    "id" in payload.project &&
    typeof payload.project.id === "string"
  );
}

// projectKeys.list(workspaceId, status?) always appends a concrete status
// segment ("ALL" when status is omitted — see project-keys.ts), so it is
// never a safe prefix for "every status-filtered list in this workspace."
// projectKeys.lists() is the narrowest key that is still guaranteed to match
// whichever status-filtered variant a component actually has mounted (e.g.
// use-projects-with-task-counts.ts queries with a specific status) — a
// project being created or archived can move it in or out of any of those
// filtered buckets, so this is a required invalidation, not just a
// defensive/broad one.
function invalidateProjectLists(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
}

// Workspace/invitation payload shapes, per
// backend/src/modules/workspace/workspace.service.ts and
// backend/src/modules/invitation/invitation.service.ts.
interface WorkspaceScopedPayload {
  workspaceId: string;
}

function isWorkspaceScopedPayload(payload: unknown): payload is WorkspaceScopedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "workspaceId" in payload &&
    typeof payload.workspaceId === "string"
  );
}

/**
 * Runs on every "connect" (the very first login connect, every automatic
 * reconnect after a network drop, and every reconnect Commit 6 triggers
 * after a membership change) — see RealtimeProvider's handleConnect.
 *
 * The backend has no missed-event replay mechanism: any event emitted while
 * the socket was disconnected (30s idle, laptop sleep, wifi drop, etc.) is
 * permanently lost. Rather than trying to replay individual missed events,
 * this does one coarse refresh limited to the two query families that go
 * stale purely from *time passing while the user is away*, not from an
 * action they'd naturally cause a refetch for themselves:
 * notifications (badge/list) and activity feeds. Tasks, comments,
 * attachments, projects, and workspaces are deliberately excluded — those
 * are already covered by their own explicit handlers above when the socket
 * is connected, and by ordinary navigation/refetch when it wasn't.
 *
 * Imported into RealtimeProvider as a single function (not raw query keys),
 * the same way the domain-event handlers above are — the provider stays
 * generic connection-lifecycle infrastructure with no direct feature
 * imports of its own.
 */
export function runReconnectCatchUp(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
  queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
  queryClient.invalidateQueries({ queryKey: activityKeys.all });
}

/**
 * The single place every realtime-reactive feature plugs into.
 * RealtimeProvider iterates this table and registers exactly one
 * socket.on(...) per entry — no feature should ever call socket.on directly.
 *
 * PR #58 architecture decision: realtime never owns data, it only tells
 * React Query something changed — every handler invalidates, none write to
 * the cache directly (no setQueryData, no optimistic updates).
 */
export const realtimeHandlers: Partial<Record<RealtimeEvent, RealtimeHandler>> = {
  [REALTIME_EVENTS.NOTIFICATION_CREATED]: (_payload, queryClient) => {
    invalidateNotificationQueries(queryClient);
  },

  [REALTIME_EVENTS.NOTIFICATION_READ]: (_payload, queryClient) => {
    invalidateNotificationQueries(queryClient);
  },

  [REALTIME_EVENTS.NOTIFICATION_READ_ALL]: (_payload, queryClient) => {
    invalidateNotificationQueries(queryClient);
  },

  [REALTIME_EVENTS.COMMENT_CREATED]: (payload, queryClient) => {
    if (!isCommentCreatedOrUpdatedPayload(payload)) {
      return;
    }
    invalidateTaskComments(payload.taskId, queryClient);
  },

  [REALTIME_EVENTS.COMMENT_UPDATED]: (payload, queryClient) => {
    if (!isCommentCreatedOrUpdatedPayload(payload)) {
      return;
    }
    invalidateTaskComments(payload.taskId, queryClient);
  },

  [REALTIME_EVENTS.COMMENT_DELETED]: (payload, queryClient) => {
    if (!isCommentDeletedPayload(payload)) {
      return;
    }
    invalidateTaskComments(payload.taskId, queryClient);
  },

  [REALTIME_EVENTS.ATTACHMENT_UPLOADED]: (payload, queryClient) => {
    if (!isAttachmentPayload(payload)) {
      return;
    }
    invalidateTaskAttachments(payload.taskId, queryClient);
  },

  [REALTIME_EVENTS.ATTACHMENT_DELETED]: (payload, queryClient) => {
    if (!isAttachmentPayload(payload)) {
      return;
    }
    invalidateTaskAttachments(payload.taskId, queryClient);
  },

  [REALTIME_EVENTS.ACTIVITY_CREATED]: (payload, queryClient) => {
    if (!isActivityCreatedPayload(payload)) {
      return;
    }
    const { workspaceId, activity } = payload;
    queryClient.invalidateQueries({
      queryKey: activityKeys.list(workspaceId, activity.entityType, activity.entityId),
    });
  },

  [REALTIME_EVENTS.TASK_CREATED]: (payload, queryClient) => {
    if (!isTaskEventPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: taskKeys.list(payload.task.projectId) });
  },

  [REALTIME_EVENTS.TASK_UPDATED]: (payload, queryClient) => {
    if (!isTaskEventPayload(payload)) {
      return;
    }
    invalidateTask(payload.task.id, payload.task.projectId, queryClient);
  },

  [REALTIME_EVENTS.TASK_COMPLETED]: (payload, queryClient) => {
    if (!isTaskEventPayload(payload)) {
      return;
    }
    invalidateTask(payload.task.id, payload.task.projectId, queryClient);
  },

  [REALTIME_EVENTS.TASK_DELETED]: (payload, queryClient) => {
    if (!isTaskEventPayload(payload)) {
      return;
    }
    invalidateTask(payload.task.id, payload.task.projectId, queryClient);
  },

  [REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT]: (payload, queryClient) => {
    if (!isSprintTaskEventPayload(payload)) {
      return;
    }
    invalidateTask(payload.task.id, payload.projectId, queryClient);
  },

  [REALTIME_EVENTS.TASK_REMOVED_FROM_SPRINT]: (payload, queryClient) => {
    if (!isSprintTaskEventPayload(payload)) {
      return;
    }
    invalidateTask(payload.task.id, payload.projectId, queryClient);
  },

  [REALTIME_EVENTS.PROJECT_CREATED]: (_payload, queryClient) => {
    invalidateProjectLists(queryClient);
  },

  [REALTIME_EVENTS.PROJECT_UPDATED]: (payload, queryClient) => {
    if (!isProjectEventPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(payload.project.id) });
    invalidateProjectLists(queryClient);
  },

  [REALTIME_EVENTS.PROJECT_ARCHIVED]: (payload, queryClient) => {
    if (!isProjectEventPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(payload.project.id) });
    invalidateProjectLists(queryClient);
  },

  // project.restored is declared in REALTIME_EVENTS but is never emitted —
  // no restore/un-archive function exists in project.service.ts — so there is
  // deliberately no handler for it here; adding one would wire up an event
  // that structurally cannot fire.

  [REALTIME_EVENTS.MEMBER_LEFT]: (payload, queryClient) => {
    if (!isWorkspaceScopedPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: workspaceKeys.members(payload.workspaceId) });
  },

  [REALTIME_EVENTS.OWNERSHIP_TRANSFERRED]: (payload, queryClient) => {
    if (!isWorkspaceScopedPayload(payload)) {
      return;
    }
    // Unlike member.left, this changes what the *current user's own* role is
    // for the two members involved (Workspace.role in workspace-keys' list()/
    // detail() reflects "my role in this workspace") — so, alongside the
    // member list, both are invalidated too.
    queryClient.invalidateQueries({ queryKey: workspaceKeys.members(payload.workspaceId) });
    queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(payload.workspaceId) });
    queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
  },

  [REALTIME_EVENTS.INVITATION_CREATED]: (payload, queryClient) => {
    if (!isWorkspaceScopedPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(payload.workspaceId) });
  },

  [REALTIME_EVENTS.INVITATION_ACCEPTED]: (payload, queryClient) => {
    if (!isWorkspaceScopedPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(payload.workspaceId) });
    queryClient.invalidateQueries({ queryKey: workspaceKeys.members(payload.workspaceId) });
  },

  [REALTIME_EVENTS.INVITATION_DECLINED]: (payload, queryClient) => {
    if (!isWorkspaceScopedPayload(payload)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(payload.workspaceId) });
  },
};
