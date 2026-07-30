import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { markNotificationRead } from "../api/notifications.api";
import { notificationKeys } from "../lib/notification-keys";
import type { Notification } from "../types";

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<Notification, AppError, string>({
    mutationFn: (notificationId) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
