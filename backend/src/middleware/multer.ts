import multer from "multer";
import type { NextFunction, Request, Response } from "express";

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

// Multer reports oversized/malformed uploads via next(err) before the
// route handler ever runs. Handled here, scoped to the avatar upload
// route only, so the error doesn't fall through to Express's default
// (non-JSON) error handler.
export function handleAvatarUploadError(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Avatar file exceeds the maximum size of 5MB.",
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid avatar upload.",
      },
    });
  }

  return next(error);
}