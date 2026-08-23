import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";

import { uploadAvatar, getAvatar, deleteAvatar } from "./user.service.js";

import { logger } from "../../lib/logger.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

export async function uploadAvatarHandler(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    throw new ValidationError("Avatar file is required.");
  }

  await uploadAvatar(req.user!.id, file);

  return res.status(200).json({
    success: true,
    data: {
      hasAvatar: true,
    },
  });
}

async function streamAvatar(userId: string, res: Response): Promise<void> {
  const avatar = await getAvatar(userId);

  res.setHeader("Content-Type", avatar.mimeType);
  res.setHeader("Content-Length", avatar.size.toString());
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  // X-Content-Type-Options: nosniff is now set globally by
  // middleware/security-headers.ts, mounted ahead of this route.

  try {
    // pipeline() (unlike a bare .pipe()) guarantees the source stream is
    // destroyed when the destination closes early — e.g. the client
    // disconnects mid-download — not just when the source itself errors.
    await pipeline(avatar.stream, res);
  } catch (error) {
    logger.error({ err: error }, "Avatar stream error");

    // pipeline() always destroys the destination on failure — including
    // when the source errors before any bytes were written, well before
    // headersSent would be true. Attempting a JSON response on an
    // already-destroyed res is a no-op write into a torn-down connection,
    // so both conditions must be checked, not headersSent alone.
    if (!res.headersSent && !res.destroyed) {
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
    }
  }
}

export async function getAvatarHandler(req: Request, res: Response) {
  await streamAvatar(req.user!.id, res);
}

// getAvatar() is already user-id generic (not implicitly self-scoped) - see
// its own comment in user.service.ts - so this reuses it directly with the
// requested :id rather than the caller's own id. Any authenticated user may
// request any other user's avatar (no workspace-membership check): this
// mirrors getAvatar()'s existing behavior of returning the same "Avatar not
// found." 404 for both a nonexistent user and a real user with no avatar,
// so this endpoint never discloses whether :id refers to a real account.
export async function getUserAvatarHandler(req: Request, res: Response) {
  await streamAvatar(req.params.id as string, res);
}

export async function deleteAvatarHandler(req: Request, res: Response) {
  await deleteAvatar(req.user!.id);

  return res.status(204).send();
}
