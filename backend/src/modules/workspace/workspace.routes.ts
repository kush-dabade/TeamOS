import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  createWorkspaceHandler,
  getUserWorkspacesHandler,
} from "./workspace.controller.js";

const router = Router();

router.post("/", requireAuth, createWorkspaceHandler);

router.get("/", requireAuth, getUserWorkspacesHandler);

export default router;