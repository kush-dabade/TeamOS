import type { Readable } from "node:stream";

export type StorageDriver = "local" | "s3";

export interface UploadRequest {
  content: Buffer | Readable;
  directory: string;
  originalFileName: string;
  mimeType: string;
  size: number;
}

export interface StorageObject {
  storageKey: string;
  storageFileName: string;
  mimeType: string;
  size: number;
}

export interface FileStream {
  stream: Readable;
  size: number;
}