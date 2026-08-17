import { useInfiniteQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchNotifications, type ListNotificationsResult } from "../api/notifications.api";
import { notificationKeys } from "../lib/notification-keys";

const NOTIFICATIONS_PAGE_LIMIT = 20;

// Cursor-based feed, so pagination is a `useInfiniteQuery` rather than the
// page/limit-in-the-key approach Task pagination uses - every page lives
// under the single `notificationKeys.lists()` cache entry (no cursor/page
// appended to the key), which is also why mark-read/mark-all-read/realtime
// invalidation of that same key continues to work unchanged: invalidating an
// infinite query refetches every page already loaded.
//
// `enabled` lets the popover defer the list fetch until it's actually opened,
// while the unread count (`useUnreadNotificationCount`) stays always-on so the
// header badge is correct before the user ever opens the popover.
export function useNotifications(enabled: boolean) {
  return useInfiniteQuery<ListNotificationsResult, AppError>({
    queryKey: notificationKeys.lists(),
    queryFn: ({ pageParam }) =>
      fetchNotifications({ limit: NOTIFICATIONS_PAGE_LIMIT, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined,
    enabled,
  });
}
