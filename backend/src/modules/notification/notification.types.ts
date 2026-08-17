import type { NotificationType } from "../../generated/prisma/enums.js";

export type NotificationResponse = {
  id: string;

  workspaceId: string;
  recipientId: string;

  type: NotificationType;

  title: string;
  message: string;

  metadata: Record<string, unknown> | null;

  isRead: boolean;
  readAt: Date | null;

  createdAt: Date;
};

export interface CreateNotificationData {
  workspaceId: string;

  recipientId: string;

  type: NotificationType;

  title: string;
  message: string;

  metadata?: Record<string, unknown>;
}

export interface ListNotificationsOptions {
  limit: number;
  cursor?: string | undefined;
}

export interface NotificationCursorData {
  createdAt: Date;
  id: string;
}

export interface NotificationPagination {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ListNotificationsResult {
  notifications: NotificationResponse[];
  pagination: NotificationPagination;
}