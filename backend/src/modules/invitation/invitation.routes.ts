import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  listUserInvitationsHandler,
  acceptInvitationHandler,
  declineInvitationHandler,
} from "./invitation.controller.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  listUserInvitationsHandler,
);

router.post(
  "/:invitationId/accept",
  requireAuth,
  acceptInvitationHandler,
);

router.post(
  "/:invitationId/decline",
  requireAuth,
  declineInvitationHandler,
);

export default router;