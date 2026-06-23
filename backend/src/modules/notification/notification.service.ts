import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreateNotificationData,
  NotificationResponse,
} from "./notification.types.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";

async function findNotificationById(notificationId: string) {
  return prisma.notification.findFirst({
    where: {
      id: notificationId,
      deletedAt: null,
    },
  });
}

type NotificationEntity = {
  id: string;

  workspaceId: string;
  recipientId: string;

  type: NotificationResponse["type"];

  metadata: unknown;

  isRead: boolean;

  createdAt: Date;
};

function toNotificationResponse(
  notification: NotificationEntity,
): NotificationResponse {
  return {
    id: notification.id,

    workspaceId: notification.workspaceId,
    recipientId: notification.recipientId,

    type: notification.type,

    metadata: (notification.metadata as Record<string, unknown> | null) ?? null,

    isRead: notification.isRead,

    createdAt: notification.createdAt,
  };
}

export async function createNotification(
  data: CreateNotificationData,
): Promise<void> {
  await prisma.notification.create({
    data: {
      workspaceId: data.workspaceId,

      recipientId: data.recipientId,

      type: data.type,

      ...(data.metadata && {
        metadata: data.metadata as Prisma.InputJsonValue,
      }),
    },
  });
}

export async function listNotifications(
  actorId: string,
): Promise<NotificationResponse[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: actorId,
      deletedAt: null,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return notifications.map(toNotificationResponse);
}

export async function markNotificationRead(
  actorId: string,
  notificationId: string,
): Promise<NotificationResponse> {
  const notification = await findNotificationById(notificationId);

  if (!notification) {
    throw new NotFoundError("Notification not found");
  }

  if (notification.recipientId !== actorId) {
    throw new ForbiddenError("You do not have access to this notification");
  }

  const updatedNotification = notification.isRead
    ? notification
    : await prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          isRead: true,
        },
      });

  return toNotificationResponse(updatedNotification);
}

export async function markAllNotificationsRead(
  actorId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      recipientId: actorId,

      isRead: false,

      deletedAt: null,
    },

    data: {
      isRead: true,
    },
  });

  return result.count;
}

export { findNotificationById };
