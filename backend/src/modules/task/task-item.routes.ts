import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  deleteTaskHandler,
  getTaskByIdHandler,
  updateTaskHandler,
} from "./task.controller.js";

const router = Router();

router.get("/:taskId", requireAuth, getTaskByIdHandler);
router.patch("/:taskId", requireAuth, updateTaskHandler);
router.delete("/:taskId", requireAuth, deleteTaskHandler);

export default router;
