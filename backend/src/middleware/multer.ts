import multer from "multer";

import { ATTACHMENT_MAX_FILE_SIZE } from "../modules/attachment/attachment.config.js";
import { AVATAR_MAX_FILE_SIZE } from "../modules/user/user.config.js";

const attachmentUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: ATTACHMENT_MAX_FILE_SIZE,
  },
});

export const uploadSingleAttachment = attachmentUpload.single("file");

const avatarUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: AVATAR_MAX_FILE_SIZE,
  },
});

export const uploadSingleAvatar = avatarUpload.single("file");