import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { markAllNotificationsRead } from "../api/notifications.api";
import { notificationKeys } from "../lib/notification-keys";

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation<number, AppError, void>({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
