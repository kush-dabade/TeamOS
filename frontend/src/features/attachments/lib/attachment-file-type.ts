import { FileArchive, FileImage, FileText, File as FileIcon, type LucideIcon } from "lucide-react";

interface AttachmentFileType {
  icon: LucideIcon;
  label: string;
}

// Frontend-chosen icon + short type label per backend-allowed MIME type (see
// backend/src/modules/attachment/attachment.config.ts). Falls back to a
// neutral icon and generic label for any type missing from this map, so a
// new backend allowlist entry never breaks the list.
export const ATTACHMENT_FILE_TYPES: Record<string, AttachmentFileType> = {
  "application/pdf": { icon: FileText, label: "PDF" },
  "image/jpeg": { icon: FileImage, label: "JPG" },
  "image/png": { icon: FileImage, label: "PNG" },
  "image/webp": { icon: FileImage, label: "WEBP" },
  "text/plain": { icon: FileText, label: "TXT" },
  "application/zip": { icon: FileArchive, label: "ZIP" },
};

export const DEFAULT_ATTACHMENT_FILE_TYPE: AttachmentFileType = { icon: FileIcon, label: "File" };
