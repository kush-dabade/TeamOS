import type {
  FileStream,
  StorageObject,
  UploadRequest,
} from "./storage.types.js";

export interface StorageProvider {
  upload(request: UploadRequest): Promise<StorageObject>;
  delete(storageKey: string): Promise<void>;
  stream(storageKey: string): Promise<FileStream>;
  exists(storageKey: string): Promise<boolean>;
}