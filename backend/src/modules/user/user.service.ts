import path from "node:path";

import { prisma } from "../../lib/prisma.js";
import {
  storageService,
  FileNotFoundError,
  getMimeTypeExtension,
  getExtensionMimeType,
} from "../../storage/index.js";

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
  // at this point.
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

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { image: storageObject.storageKey },
    });
  } catch (error) {
    // Persistence failed: roll back the newly uploaded file and leave the
    // existing avatar reference untouched.
    try {
      await storageService.delete(storageObject.storageKey);
    } catch {
      // Best-effort rollback; preserve the original error below.
    }

    throw error;
  }

  // Only remove the old avatar once the new one is successfully stored
  // and persisted.
  if (previousUser?.image && previousUser.image !== storageObject.storageKey) {
    try {
      await storageService.delete(previousUser.image);
    } catch (error) {
      console.error("Failed to delete previous avatar file:", error);
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

  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  });

  try {
    await storageService.delete(storageKey);
  } catch (error) {
    if (!(error instanceof FileNotFoundError)) {
      console.error("Failed to delete avatar file:", error);
    }
    // Best-effort cleanup; the user record is already updated.
  }
}
