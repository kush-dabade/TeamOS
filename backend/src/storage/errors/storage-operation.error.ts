import { StorageError } from "./storage.error.js";

export class StorageOperationError extends StorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);

    this.name = "StorageOperationError";
  }
}