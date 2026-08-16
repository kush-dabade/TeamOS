// Mirrors backend/src/modules/attachment/attachment.config.ts. Duplicated
// (not imported) since frontend and backend are separate TS build targets -
// same relationship ATTACHMENT_FILE_TYPES already has to that file. Used to
// give client-side upload feedback before the round trip; the backend
// remains the source of truth and re-validates independently.
export const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",

  "image/jpeg",
  "image/png",
  "image/webp",

  "text/plain",

  "application/zip",
] as const;
