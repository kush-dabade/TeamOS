import type { NotificationType } from "../../generated/prisma/enums.js";

export type NotificationResponse = {
  id: string;

  workspaceId: string;
  recipientId: string;

  type: NotificationType;

  metadata: Record<string, unknown> | null;

  isRead: boolean;

  createdAt: Date;
};

export interface CreateNotificationData {
  workspaceId: string;

  recipientId: string;

  type: NotificationType;

  metadata?: Record<string, unknown>;
}