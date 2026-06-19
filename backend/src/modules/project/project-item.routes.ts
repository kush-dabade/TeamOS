import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  archiveProjectHandler,
  getProjectHandler,
  updateProjectHandler,
} from "./project.controller.js";

const router = Router();

router.get("/:projectId", requireAuth, getProjectHandler);
router.patch("/:projectId", requireAuth, updateProjectHandler);
router.post("/:projectId/archive", requireAuth, archiveProjectHandler);

export default router;
