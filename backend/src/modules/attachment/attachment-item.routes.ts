import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  downloadAttachmentHandler,
  deleteAttachmentHandler,
} from "./attachment.controller.js";

const router = Router();

router.get("/:attachmentId", requireAuth, downloadAttachmentHandler);

router.delete("/:attachmentId", requireAuth, deleteAttachmentHandler);

export default router;