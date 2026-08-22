export interface AttachmentUploader {
  id: string;
  name: string;
  image: string | null;
}

export interface AttachmentResponse {
  id: string;

  originalName: string;

  mimeType: string;

  size: number;

  uploader: AttachmentUploader;

  createdAt: Date;
}

export interface ListTaskAttachmentsOptions {
  taskId: string;

  page: number;
  limit: number;
}

export interface ListTaskAttachmentsResult {
  attachments: AttachmentResponse[];
  total: number;
}

export interface DownloadAttachmentResponse {
  stream: NodeJS.ReadableStream;

  mimeType: string;

  originalName: string;

  size: number;
}