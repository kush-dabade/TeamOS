import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchUnreadNotificationCount } from "../api/notifications.api";
import { notificationKeys } from "../lib/notification-keys";

export function useUnreadNotificationCount() {
  return useQuery<number, AppError>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadNotificationCount,
  });
}
