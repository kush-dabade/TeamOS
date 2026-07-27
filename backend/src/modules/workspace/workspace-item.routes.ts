import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  getWorkspaceHandler,
  updateWorkspaceHandler,
} from "./workspace.controller.js";

const router = Router();

router.get("/:workspaceId", requireAuth, getWorkspaceHandler);

router.patch("/:workspaceId", requireAuth, updateWorkspaceHandler);

export default router;
