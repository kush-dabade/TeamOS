import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import { listWorkspaceTasksHandler } from "./task.controller.js";

const router = Router();

router.get("/:workspaceId/tasks", requireAuth, listWorkspaceTasksHandler);

export default router;
