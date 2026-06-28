import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { uploadSingleAttachment } from "../../middleware/multer.js";

import { uploadAttachmentHandler } from "./attachment.controller.js";

const router = Router();

router.post(
  "/tasks/:taskId/attachments",
  requireAuth,
  uploadSingleAttachment,
  uploadAttachmentHandler,
);

export default router;
