import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { uploadSingleAvatar } from "../../middleware/multer.js";
import { avatarLimiter } from "../../middleware/rate-limit.js";

import {
  uploadAvatarHandler,
  getAvatarHandler,
  deleteAvatarHandler,
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

export default router;
