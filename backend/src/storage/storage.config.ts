import { InvalidStorageDriverError } from "./errors/invalid-storage-driver.error.js";
import type { StorageDriver } from "./storage.types.js";

const driver = process.env.STORAGE_DRIVER ?? "local";
const rootDirectory = process.env.STORAGE_ROOT ?? "uploads";

const supportedDrivers: readonly StorageDriver[] = ["local"];

if (!supportedDrivers.includes(driver as StorageDriver)) {
  throw new InvalidStorageDriverError(driver);
}

export const storageConfig = Object.freeze({
  driver: driver as StorageDriver,
  rootDirectory,
});