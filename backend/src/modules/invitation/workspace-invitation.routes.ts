import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  createInvitationHandler,
  listWorkspaceInvitationsHandler,
} from "./invitation.controller.js";

const router = Router();

router.post("/:workspaceId/invitations", requireAuth, createInvitationHandler);

router.get(
  "/:workspaceId/invitations",
  requireAuth,
  listWorkspaceInvitationsHandler,
);

export default router;