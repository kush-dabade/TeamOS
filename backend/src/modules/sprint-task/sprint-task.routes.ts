import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  assignTaskToSprintHandler,
  removeTaskFromSprintHandler,
  listSprintTasksHandler,
} from "./sprint-task.controller.js";

const router = Router();

router.post("/:sprintId/tasks/:taskId", requireAuth, assignTaskToSprintHandler);

router.delete(
  "/:sprintId/tasks/:taskId",
  requireAuth,
  removeTaskFromSprintHandler,
);

router.get("/:sprintId/tasks", requireAuth, listSprintTasksHandler);

export default router;
