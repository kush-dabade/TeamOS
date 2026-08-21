import path from "node:path";

import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import {
  storageService,
  FileNotFoundError,
  getMimeTypeExtension,
  getExtensionMimeType,
} from "../../storage/index.js";

import { ConflictError } from "../../shared/errors/conflict-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

import { ALLOWED_AVATAR_MIME_TYPES } from "./user.config.js";
import type { AvatarStreamResponse } from "./user.types.js";

function validateAvatarMimeType(mimeType: string): void {
  if (
    !ALLOWED_AVATAR_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_AVATAR_MIME_TYPES)[number],
    )
  ) {
    throw new ValidationError("Unsupported avatar file type.");
  }
}

// Physical storage layout:
//
// users/{userId}/avatar/
function buildAvatarDirectory(userId: string): string {
  return `users/${userId}/avatar`;
}

export async function uploadAvatar(
  userId: string,
  file: Express.Multer.File,
): Promise<void> {
  validateAvatarMimeType(file.mimetype);

  // The extension is derived from the validated MIME type, never from the
  // client-supplied original filename, so the storage key can't be
  // influenced by an untrusted name.
  const extension = getMimeTypeExtension(file.mimetype);

  if (!extension) {
    throw new ValidationError("Unsupported avatar file type.");
  }

  const directory = buildAvatarDirectory(userId);

  // Store the new file first; the previous avatar (if any) is untouched
  // at this point. This write is outside PostgreSQL's transactional
  // boundary - no DB transaction can make it atomic with the update below,
  // so correctness has to come from the conditional update, not from
  // wrapping these two operations together.
  const storageObject = await storageService.upload({
    content: file.buffer,
    directory,
    originalFileName: `avatar${extension}`,
    mimeType: file.mimetype,
    size: file.size,
  });

  const previousUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  const previousImage = previousUser?.image ?? null;

  let result;

  try {
    // Optimistic concurrency: only persist if `image` still matches what we
    // just read. `image` doubles as the compare-and-swap token, so no
    // separate version column is needed. `update()` can't express this
    // (Prisma only accepts unique-key filters there); `updateMany()` can.
    result = await prisma.user.updateMany({
      where: { id: userId, image: previousImage },
      data: { image: storageObject.storageKey },
    });
  } catch (error) {
    // Persistence failed outright (not a race, a genuine error): roll back
    // the newly uploaded file and leave the existing avatar untouched.
    try {
      await storageService.delete(storageObject.storageKey);
    } catch {
      // Best-effort rollback; preserve the original error below.
    }

    throw error;
  }

  if (result.count === 0) {
    // Lost the race: another request changed `image` between our read and
    // our write. Clean up our own now-orphaned upload rather than leaving
    // it unreferenced, and let the caller retry against the current state.
    try {
      await storageService.delete(storageObject.storageKey);
    } catch (error) {
      logger.error({ err: error }, "Failed to clean up losing avatar upload");
    }

    throw new ConflictError(
      "Your avatar changed while this upload was in progress. Please try again.",
    );
  }

  // We won the race - only now remove the old avatar, since we know our
  // write is the one that's actually current.
  if (previousImage && previousImage !== storageObject.storageKey) {
    try {
      await storageService.delete(previousImage);
    } catch (error) {
      logger.error({ err: error }, "Failed to delete previous avatar file");
    }
  }
}

export async function getAvatar(userId: string): Promise<AvatarStreamResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });

  if (!user?.image) {
    throw new NotFoundError("Avatar not found.");
  }

  const mimeType =
    getExtensionMimeType(path.posix.extname(user.image)) ??
    "application/octet-stream";

  try {
    const file = await storageService.stream(user.image);

    return {
      stream: file.stream,
      size: file.size,
      mimeType,
    };
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      throw new NotFoundError("Avatar not found.");
    }

    throw error;
  }
}

export async function deleteAvatar(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });

  if (!user?.image) {
    // No avatar to remove; treat as a successful no-op.
    return;
  }

  const storageKey = user.image;

  // Same compare-and-swap as uploadAvatar: only clear `image` if it still
  // matches what we just read.
  const result = await prisma.user.updateMany({
    where: { id: userId, image: storageKey },
    data: { image: null },
  });

  if (result.count === 0) {
    // Lost the race: some other request already changed `image` since we
    // read it - either another delete already cleared it, or a concurrent
    // upload replaced it with a newer avatar. Either way that request owns
    // the current state; deleting `storageKey` here could remove a file a
    // concurrent upload just made current, so treat this as a no-op rather
    // than a failure.
    return;
  }

  try {
    await storageService.delete(storageKey);
  } catch (error) {
    if (!(error instanceof FileNotFoundError)) {
      logger.error({ err: error }, "Failed to delete avatar file");
    }
    // Best-effort cleanup; the user record is already updated.
  }
}
