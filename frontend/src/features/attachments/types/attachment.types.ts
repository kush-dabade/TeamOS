export interface AttachmentUploader {
  id: string;
  name: string;
  image: string | null;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploader: AttachmentUploader;
  createdAt: string;
}
