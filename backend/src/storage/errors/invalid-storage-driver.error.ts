import { StorageError } from "./storage.error.js";

export class InvalidStorageDriverError extends StorageError {
  constructor(driver: string, options?: ErrorOptions) {
    super(`Unsupported storage driver: ${driver}`, options);

    this.name = "InvalidStorageDriverError";
  }
}