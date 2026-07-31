import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  listUserInvitationsHandler,
  getInvitationPreviewHandler,
  acceptInvitationHandler,
  acceptInvitationByTokenHandler,
  declineInvitationHandler,
} from "./invitation.controller.js";

const router = Router();

router.get("/token/:token", getInvitationPreviewHandler);

router.post(
  "/token/:token/accept",
  requireAuth,
  acceptInvitationByTokenHandler,
);

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