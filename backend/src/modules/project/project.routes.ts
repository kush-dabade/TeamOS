import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import { createProjectHandler, listProjectsHandler } from "./project.controller.js";

const router = Router();

router.post("/:workspaceId/projects", requireAuth, createProjectHandler);
router.get(
  "/:workspaceId/projects",
  requireAuth,
  listProjectsHandler
);

export default router;
