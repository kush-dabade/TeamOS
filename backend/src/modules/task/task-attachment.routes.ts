import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { uploadSingleAttachment } from "../../middleware/multer.js";

import {
  uploadAttachmentHandler,
  listTaskAttachmentsHandler,
} from "../attachment/attachment.controller.js";

const router = Router();

router.post(
  "/:taskId/attachments",
  requireAuth,
  uploadSingleAttachment,
  uploadAttachmentHandler,
);

router.get("/:taskId/attachments", requireAuth, listTaskAttachmentsHandler);

export default router;
