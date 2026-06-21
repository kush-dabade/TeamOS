import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  createSprintHandler,
  listSprintsHandler,
} from "./sprint.controller.js";

const router = Router();

router.post("/:projectId/sprints", requireAuth, createSprintHandler);

router.get("/:projectId/sprints", requireAuth, listSprintsHandler);

export default router;
