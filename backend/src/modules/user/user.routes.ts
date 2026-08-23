import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { uploadSingleAvatar } from "../../middleware/multer.js";
import { avatarLimiter } from "../../middleware/rate-limit.js";

import {
  uploadAvatarHandler,
  getAvatarHandler,
  deleteAvatarHandler,
  getUserAvatarHandler,
} from "./user.controller.js";

const router = Router();

router.post(
  "/me/avatar",
  requireAuth,
  avatarLimiter,
  uploadSingleAvatar,
  uploadAvatarHandler,
);

router.get("/me/avatar", requireAuth, getAvatarHandler);

router.delete("/me/avatar", requireAuth, deleteAvatarHandler);

// Registered after /me/avatar so the literal "me" segment above always wins
// on GET - Express matches routes in registration order, and ":id" would
// otherwise also match "me" as a param value.
router.get("/:id/avatar", requireAuth, getUserAvatarHandler);

export default router;
