import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  createWorkspaceHandler,
  getUserWorkspacesHandler,
  listWorkspaceMembersHandler,
  updateWorkspaceMemberRoleHandler,
  removeWorkspaceMemberHandler,
} from "./workspace.controller.js";

const router = Router();

router.post("/", requireAuth, createWorkspaceHandler);

router.get("/", requireAuth, getUserWorkspacesHandler);

router.get("/:workspaceId/members", requireAuth, listWorkspaceMembersHandler);

router.patch(
  "/:workspaceId/members/:memberId",
  requireAuth,
  updateWorkspaceMemberRoleHandler,
);

router.delete(
  "/:workspaceId/members/:memberId",
  requireAuth,
  removeWorkspaceMemberHandler,
);

export default router;