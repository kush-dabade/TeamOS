import type { Request, Response } from "express";

import { uploadAvatar, getAvatar, deleteAvatar } from "./user.service.js";

import { ConflictError } from "../../shared/errors/conflict-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

export async function uploadAvatarHandler(req: Request, res: Response) {
  try {
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
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    if (error instanceof ConflictError) {
      return res.status(409).json({
        success: false,
        error: {
          code: "AVATAR_CONFLICT",
          message: error.message,
        },
      });
    }

    console.error("Avatar upload error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function getAvatarHandler(req: Request, res: Response) {
  try {
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
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "AVATAR_NOT_FOUND",
          message: error.message,
        },
      });
    }

    console.error("Avatar retrieval error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function deleteAvatarHandler(req: Request, res: Response) {
  try {
    await deleteAvatar(req.user!.id);

    return res.status(204).send();
  } catch (error) {
    console.error("Avatar delete error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
