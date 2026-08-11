import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { invitationLimiter } from "../../middleware/rate-limit.js";

import {
  createInvitationHandler,
  listWorkspaceInvitationsHandler,
  cancelInvitationHandler,
  resendInvitationHandler,
} from "./invitation.controller.js";

const router = Router();

router.post(
  "/:workspaceId/invitations",
  requireAuth,
  invitationLimiter,
  createInvitationHandler,
);

router.get(
  "/:workspaceId/invitations",
  requireAuth,
  listWorkspaceInvitationsHandler,
);

router.post(
  "/:workspaceId/invitations/:invitationId/resend",
  requireAuth,
  invitationLimiter,
  resendInvitationHandler,
);

router.delete(
  "/:workspaceId/invitations/:invitationId",
  requireAuth,
  cancelInvitationHandler,
);

export default router;