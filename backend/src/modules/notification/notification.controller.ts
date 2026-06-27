import type { Request, Response } from "express";

import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notification.service.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";

export async function listNotificationsHandler(req: Request, res: Response) {
  try {
    const notifications = await listNotifications(req.user!.id);

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    console.error("List notifications error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function markNotificationReadHandler(req: Request, res: Response) {
  try {
    const notification = await markNotificationAsRead(
      req.user!.id,
      req.params.notificationId as string,
    );

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOTIFICATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    console.error("Mark notification read error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function markAllNotificationsReadHandler(
  req: Request,
  res: Response,
) {
  try {
    const updated = await markAllNotificationsAsRead(req.user!.id);

    return res.status(200).json({
      success: true,
      data: {
        updated,
      },
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
