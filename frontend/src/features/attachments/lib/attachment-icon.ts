import { FileArchive, FileImage, FileText, File as FileIcon, type LucideIcon } from "lucide-react";

// Frontend-chosen icon per backend-allowed MIME type (see
// backend/src/modules/attachment/attachment.config.ts). Falls back to a
// neutral file icon for any type missing from this map, so a new backend
// allowlist entry never breaks the list.
export const ATTACHMENT_ICONS: Record<string, LucideIcon> = {
  "application/pdf": FileText,
  "image/jpeg": FileImage,
  "image/png": FileImage,
  "image/webp": FileImage,
  "text/plain": FileText,
  "application/zip": FileArchive,
};

export const DEFAULT_ATTACHMENT_ICON: LucideIcon = FileIcon;
