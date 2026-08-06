import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Notification, NotificationType } from "../types";

interface BackendNotification {
  id: string;
  workspaceId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

function toNotification(notification: BackendNotification): Notification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    metadata: notification.metadata,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

export async function fetchNotifications(): Promise<Notification[]> {
  const response = await apiClient.get<ApiSuccess<BackendNotification[]>>("/notifications");

  return response.data.data.map(toNotification);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const response = await apiClient.get<ApiSuccess<{ count: number }>>(
    "/notifications/unread-count",
  );

  return response.data.data.count;
}

export async function markNotificationRead(notificationId: string): Promise<Notification> {
  const response = await apiClient.patch<ApiSuccess<BackendNotification>>(
    `/notifications/${notificationId}/read`,
  );

  return toNotification(response.data.data);
}
