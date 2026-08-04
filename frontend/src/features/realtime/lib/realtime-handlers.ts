import type { QueryClient } from "@tanstack/react-query";

import { notificationKeys } from "@/features/notifications";

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
};
