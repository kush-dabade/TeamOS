import type { QueryClient } from "@tanstack/react-query";

import { notificationKeys } from "@/features/notifications";
import { commentKeys } from "@/features/comments";
import { attachmentKeys } from "@/features/attachments";
import { activityKeys } from "@/features/activity";
import type { ActivityEntityType } from "@/features/activity";

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

function invalidateTaskComments(taskId: string, queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
}

// Attachment payload shapes, per backend/src/modules/attachment/attachment.service.ts.
interface AttachmentUploadedOrDeletedPayload {
  taskId: string;
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
    const { taskId } = payload as CommentCreatedOrUpdatedPayload;
    invalidateTaskComments(taskId, queryClient);
  },

  [REALTIME_EVENTS.COMMENT_UPDATED]: (payload, queryClient) => {
    const { taskId } = payload as CommentCreatedOrUpdatedPayload;
    invalidateTaskComments(taskId, queryClient);
  },

  [REALTIME_EVENTS.COMMENT_DELETED]: (payload, queryClient) => {
    const { taskId } = payload as CommentDeletedPayload;
    invalidateTaskComments(taskId, queryClient);
  },

  [REALTIME_EVENTS.ATTACHMENT_UPLOADED]: (payload, queryClient) => {
    const { taskId } = payload as AttachmentUploadedOrDeletedPayload;
    invalidateTaskAttachments(taskId, queryClient);
  },

  [REALTIME_EVENTS.ATTACHMENT_DELETED]: (payload, queryClient) => {
    const { taskId } = payload as AttachmentUploadedOrDeletedPayload;
    invalidateTaskAttachments(taskId, queryClient);
  },

  [REALTIME_EVENTS.ACTIVITY_CREATED]: (payload, queryClient) => {
    const { workspaceId, activity } = payload as ActivityCreatedPayload;
    queryClient.invalidateQueries({
      queryKey: activityKeys.list(workspaceId, activity.entityType, activity.entityId),
    });
  },
};
