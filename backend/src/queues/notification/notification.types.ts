import type { NotificationType } from "../../generated/prisma/enums.js";

export interface CreateNotificationJobData {
  workspaceId: string;

  recipientId: string;

  type: NotificationType;

  title: string;
  message: string;

  metadata?: Record<string, unknown>;
}