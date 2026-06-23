import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  listNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
} from "./notification.controller.js";

const router = Router();

router.get("/", requireAuth, listNotificationsHandler);

router.patch(
  "/read-all",
  requireAuth,
  markAllNotificationsReadHandler,
);

router.patch(
  "/:notificationId/read",
  requireAuth,
  markNotificationReadHandler,
);

export default router;