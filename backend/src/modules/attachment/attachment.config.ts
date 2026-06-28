export const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",

  "image/jpeg",
  "image/png",
  "image/webp",

  "text/plain",

  "application/zip",
] as const;