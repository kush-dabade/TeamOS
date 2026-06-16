import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import { listWorkspaceActivitiesHandler } from "./activity.controller.js";

const router = Router();

router.get(
  "/:workspaceId/activity",
  requireAuth,
  listWorkspaceActivitiesHandler,
);

export default router;
