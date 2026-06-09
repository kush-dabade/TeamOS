import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  createTaskHandler,
  listTasksHandler,
} from "./task.controller.js";

const router = Router();

router.post(
  "/:projectId/tasks",
  requireAuth,
  createTaskHandler,
);

router.get(
  "/:projectId/tasks",
  requireAuth,
  listTasksHandler,
);

export default router;