import path from "node:path";

import { createId } from "@paralleldrive/cuid2";

import { getFileExtension } from "./mime-type.js";

export interface StorageKey {
  storageKey: string;
  storageFileName: string;
}

export function generateStorageKey(
  directory: string,
  originalFileName: string,
): StorageKey {
  const extension = getFileExtension(originalFileName);
  const storageFileName = `${createId()}${extension}`;

  return {
    storageFileName,
    storageKey: path.posix.join(directory, storageFileName),
  };
}