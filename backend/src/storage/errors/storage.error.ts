export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);

    this.name = "StorageError";
  }
}