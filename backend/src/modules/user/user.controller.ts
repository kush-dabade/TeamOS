import type { Request, Response } from "express";

import { uploadAvatar, getAvatar, deleteAvatar } from "./user.service.js";

export async function uploadAvatarHandler(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Avatar file is required.",
      },
    });
  }

  await uploadAvatar(req.user!.id, file);

  return res.status(200).json({
    success: true,
    data: {
      hasAvatar: true,
    },
  });
}

export async function getAvatarHandler(req: Request, res: Response) {
  const avatar = await getAvatar(req.user!.id);

  res.setHeader("Content-Type", avatar.mimeType);
  res.setHeader("Content-Length", avatar.size.toString());
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");

  avatar.stream.on("error", (error) => {
    console.error("Avatar stream error:", error);

    if (!res.headersSent) {
      // The avatar Content-Type set above would otherwise leak onto this
      // JSON error body, since res.json() only sets Content-Type when
      // none is already present.
      res.removeHeader("Content-Type");

      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to stream avatar.",
        },
      });
    } else {
      res.destroy(error);
    }
  });

  avatar.stream.pipe(res);
}

export async function deleteAvatarHandler(req: Request, res: Response) {
  await deleteAvatar(req.user!.id);

  return res.status(204).send();
}
