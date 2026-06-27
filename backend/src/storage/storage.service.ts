import { createStorageProvider } from "./storage.factory.js";
import type { StorageProvider } from "./storage.interface.js";
import type {
  FileStream,
  StorageObject,
  UploadRequest,
} from "./storage.types.js";

export class StorageService {
  private readonly provider: StorageProvider;

  constructor(provider: StorageProvider = createStorageProvider()) {
    this.provider = provider;
  }

  upload(request: UploadRequest): Promise<StorageObject> {
    return this.provider.upload(request);
  }

  delete(storageKey: string): Promise<void> {
    return this.provider.delete(storageKey);
  }

  stream(storageKey: string): Promise<FileStream> {
    return this.provider.stream(storageKey);
  }

  exists(storageKey: string): Promise<boolean> {
    return this.provider.exists(storageKey);
  }
}

export const storageService = new StorageService();