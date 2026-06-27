import path from "node:path";

import { createId } from "@paralleldrive/cuid2";

import { getFileExtension } from "./mime-type.js";

import { StorageOperationError } from "../errors/storage-operation.error.js";

export interface StorageKey {
  storageKey: string;
  storageFileName: string;
}

export function generateStorageKey(
  directory: string,
  originalFileName: string,
): StorageKey {
  const normalizedDirectory = path.posix.normalize(directory);

  if (
    path.posix.isAbsolute(normalizedDirectory) ||
    normalizedDirectory.startsWith("..")
  ) {
    throw new StorageOperationError("Invalid storage directory.");
  }

  const extension = getFileExtension(originalFileName);
  const storageFileName = `${createId()}${extension}`;

  return {
    storageFileName,
    storageKey: path.posix.join(normalizedDirectory, storageFileName),
  };
}
