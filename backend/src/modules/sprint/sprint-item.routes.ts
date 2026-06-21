import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import { getSprintHandler, updateSprintHandler } from "./sprint.controller.js";

const router = Router();

router.get("/:sprintId", requireAuth, getSprintHandler);

router.patch("/:sprintId", requireAuth, updateSprintHandler);

export default router;
