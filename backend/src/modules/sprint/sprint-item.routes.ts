import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  getSprintHandler,
  updateSprintHandler,
  startSprintHandler,
  completeSprintHandler,
} from "./sprint.controller.js";

const router = Router();

router.get("/:sprintId", requireAuth, getSprintHandler);

router.patch("/:sprintId", requireAuth, updateSprintHandler);

router.post("/:sprintId/start", requireAuth, startSprintHandler);

router.post("/:sprintId/complete", requireAuth, completeSprintHandler);

export default router;
