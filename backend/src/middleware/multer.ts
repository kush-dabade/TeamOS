import multer from "multer";

import { ATTACHMENT_MAX_FILE_SIZE } from "../modules/attachment/attachment.config.js";

const attachmentUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: ATTACHMENT_MAX_FILE_SIZE,
  },
});

export const uploadSingleAttachment = attachmentUpload.single("file");