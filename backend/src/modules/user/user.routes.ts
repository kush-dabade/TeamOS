import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import {
  uploadSingleAvatar,
  handleAvatarUploadError,
} from "../../middleware/multer.js";

import {
  uploadAvatarHandler,
  getAvatarHandler,
  deleteAvatarHandler,
} from "./user.controller.js";

const router = Router();

router.post(
  "/me/avatar",
  requireAuth,
  uploadSingleAvatar,
  handleAvatarUploadError,
  uploadAvatarHandler,
);

router.get("/me/avatar", requireAuth, getAvatarHandler);

router.delete("/me/avatar", requireAuth, deleteAvatarHandler);

export default router;
