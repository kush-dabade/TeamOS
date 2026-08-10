import type { Request, Response } from "express";

import { notificationParamsSchema } from "./notification.schema.js";

import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} from "./notification.service.js";

export async function listNotificationsHandler(req: Request, res: Response) {
  const notifications = await listNotifications(req.user!.id);

  return res.status(200).json({
    success: true,
    data: notifications,
  });
}

export async function markNotificationReadHandler(req: Request, res: Response) {
  const params = notificationParamsSchema.parse(req.params);

  const notification = await markNotificationAsRead(
    req.user!.id,
    params.notificationId,
  );

  return res.status(200).json({
    success: true,
    data: notification,
  });
}

export async function getUnreadNotificationCountHandler(
  req: Request,
  res: Response,
) {
  const count = await getUnreadNotificationCount(req.user!.id);

  return res.status(200).json({
    success: true,
    data: {
      count,
    },
  });
}

export async function markAllNotificationsReadHandler(
  req: Request,
  res: Response,
) {
  const updated = await markAllNotificationsAsRead(req.user!.id);

  return res.status(200).json({
    success: true,
    data: {
      updated,
    },
  });
}
