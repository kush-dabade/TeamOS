import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import { updateTaskHandler } from "./task.controller.js";

const router = Router();

router.patch("/:taskId", requireAuth, updateTaskHandler);

export default router;
