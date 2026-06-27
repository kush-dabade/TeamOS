import { StorageError } from "./storage.error.js";

export class FileNotFoundError extends StorageError {
  constructor(storageKey: string, options?: ErrorOptions) {
    super(`File not found: ${storageKey}`, options);

    this.name = "FileNotFoundError";
  }
}