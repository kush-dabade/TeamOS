import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchNotifications } from "../api/notifications.api";
import { notificationKeys } from "../lib/notification-keys";
import type { Notification } from "../types";

// `enabled` lets the popover defer the list fetch until it's actually opened,
// while the unread count (`useUnreadNotificationCount`) stays always-on so the
// header badge is correct before the user ever opens the popover.
export function useNotifications(enabled: boolean) {
  return useQuery<Notification[], AppError>({
    queryKey: notificationKeys.lists(),
    queryFn: fetchNotifications,
    enabled,
  });
}
