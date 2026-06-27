import { Prisma, type Notification } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreateNotificationData,
  NotificationResponse,
} from "./notification.types.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";

async function findNotificationById(notificationId: string) {
  return prisma.notification.findUnique({
    where: {
      id: notificationId,
    },
  });
}

function toNotificationResponse(
  notification: Notification,
): NotificationResponse {
  return {
    id: notification.id,

    workspaceId: notification.workspaceId,
    recipientId: notification.recipientId,

    type: notification.type,

    title: notification.title,
    message: notification.message,

    metadata: (notification.metadata as Record<string, unknown> | null) ?? null,

    isRead: notification.isRead,
    readAt: notification.readAt,

    createdAt: notification.createdAt,
  };
}

export async function createNotification(
  data: CreateNotificationData,
): Promise<NotificationResponse> {
  const notification = await prisma.notification.create({
    data: {
      title: data.title,

      message: data.message,

      workspaceId: data.workspaceId,

      recipientId: data.recipientId,

      type: data.type,

      ...(data.metadata && {
        metadata: data.metadata as Prisma.InputJsonValue,
      }),
    },
  });

  return toNotificationResponse(notification);
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

export async function markNotificationAsRead(
  actorId: string,
  notificationId: string,
): Promise<NotificationResponse> {
  const notification = await findNotificationById(notificationId);

  if (!notification || notification.deletedAt) {
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
          readAt: new Date(),
        },
      });

  return toNotificationResponse(updatedNotification);
}

export async function markAllNotificationsAsRead(
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
      readAt: new Date(),
    },
  });

  return result.count;
}

export async function getUnreadNotificationCount(
  actorId: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId: actorId,
      isRead: false,
      deletedAt: null,
    },
  });
}

export { findNotificationById };
