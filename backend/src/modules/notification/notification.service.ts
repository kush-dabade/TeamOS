import { Prisma, type Notification } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import { notificationCursorSchema } from "./notification.schema.js";
import type {
  CreateNotificationData,
  ListNotificationsOptions,
  ListNotificationsResult,
  NotificationCursorData,
  NotificationResponse,
} from "./notification.types.js";

import { emitToUser } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

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

// Opaque to the frontend by design - callers only ever echo back the
// `nextCursor` a previous response gave them, never construct one.
// Base64 of {createdAt, id} is enough to reconstruct the keyset condition
// below without exposing (or depending on) any particular encoding.
function encodeNotificationCursor(cursor: NotificationCursorData): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
  ).toString("base64");
}

// A cursor that isn't valid Base64/JSON can't reach notificationCursorSchema
// at all, so it's reported via the same ValidationError -> 400
// VALIDATION_ERROR path the rest of the module already uses (see
// attachment.service.ts, sprint-task.service.ts) rather than a new error
// type. A cursor that decodes but has the wrong shape (e.g. missing `id`)
// is instead reported by notificationCursorSchema.parse itself throwing a
// ZodError, already handled globally the same way.
function decodeNotificationCursor(cursor: string): NotificationCursorData {
  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new ValidationError("Invalid pagination cursor");
  }

  return notificationCursorSchema.parse(decoded);
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
  options: ListNotificationsOptions,
): Promise<ListNotificationsResult> {
  const where: Prisma.NotificationWhereInput = {
    recipientId: actorId,
    deletedAt: null,
  };

  // The cursor only ever narrows further within the recipient/deletedAt
  // filter already set above - it's ANDed in alongside them (Prisma merges
  // top-level where fields with AND), so a tampered or forged cursor can
  // never widen the query past the authenticated actor's own notifications.
  if (options.cursor) {
    const cursor = decodeNotificationCursor(options.cursor);

    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }

  // Fetches one extra row (limit + 1) to determine hasMore without a
  // separate COUNT(*) - if the extra row comes back, it's dropped below
  // and never reaches the client or the cursor derivation.
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
  });

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const lastNotification = page[page.length - 1];

  const nextCursor =
    hasMore && lastNotification
      ? encodeNotificationCursor({
          createdAt: lastNotification.createdAt,
          id: lastNotification.id,
        })
      : null;

  return {
    notifications: page.map(toNotificationResponse),
    pagination: { nextCursor, hasMore },
  };
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

  const response = toNotificationResponse(updatedNotification);

  emitToUser(
    updatedNotification.recipientId,
    REALTIME_EVENTS.NOTIFICATION_READ,
    {
      notification: response,
    },
  );

  return response;
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

  emitToUser(actorId, REALTIME_EVENTS.NOTIFICATION_READ_ALL, {
    recipientId: actorId,
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
