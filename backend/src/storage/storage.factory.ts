import { storageConfig } from "./storage.config.js";
import type { StorageProvider } from "./storage.interface.js";
import { LocalStorageProvider } from "./providers/local.provider.js";

export function createStorageProvider(): StorageProvider {
  switch (storageConfig.driver) {
    case "local":
      return new LocalStorageProvider();

    case "s3":
      throw new Error("S3 storage provider is not implemented yet.");

    default:
      throw new Error(`Unsupported storage driver: ${storageConfig.driver}`);
  }
}