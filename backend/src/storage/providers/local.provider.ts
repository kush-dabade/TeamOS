import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { storageConfig } from "../storage.config.js";
import { FileNotFoundError } from "../errors/file-not-found.error.js";
import { StorageOperationError } from "../errors/storage-operation.error.js";
import type { StorageProvider } from "../storage.interface.js";
import type {
  FileStream,
  StorageObject,
  UploadRequest,
} from "../storage.types.js";
import { generateStorageKey } from "../utils/storage-key.js";

export class LocalStorageProvider implements StorageProvider {
  private resolveAbsolutePath(storageKey: string): string {
    return path.join(storageConfig.rootDirectory, storageKey);
  }

  async upload(request: UploadRequest): Promise<StorageObject> {
    try {
      const { storageKey, storageFileName } = generateStorageKey(
        request.directory,
        request.originalFileName,
      );

      const absolutePath = this.resolveAbsolutePath(storageKey);

      await fs.mkdir(path.dirname(absolutePath), {
        recursive: true,
      });

      await fs.writeFile(absolutePath, request.content);

      return {
        storageKey,
        storageFileName,
        mimeType: request.mimeType,
        size: request.size,
      };
    } catch (error) {
      throw new StorageOperationError("Failed to upload file.", {
        cause: error,
      });
    }
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(storageKey);

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FileNotFoundError(storageKey, { cause: error });
      }

      throw new StorageOperationError("Failed to delete file.", {
        cause: error,
      });
    }
  }

  async stream(storageKey: string): Promise<FileStream> {
    const absolutePath = this.resolveAbsolutePath(storageKey);

    try {
      const stats = await fs.stat(absolutePath);

      return {
        stream: createReadStream(absolutePath),
        size: stats.size,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FileNotFoundError(storageKey, { cause: error });
      }

      throw new StorageOperationError("Failed to stream file.", {
        cause: error,
      });
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolveAbsolutePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }
}
