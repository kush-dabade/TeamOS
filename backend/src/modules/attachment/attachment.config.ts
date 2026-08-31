export const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// A tighter limit for demo accounts (modules/demo/, Commit 3) - real users
// keep the full 10MB above. This only bounds an anonymous, free-to-create
// demo identity from being usable as unrestricted file storage; 2MB is
// generous enough to demonstrate the attachment feature (a screenshot, a
// short PDF) while keeping the abuse ceiling small. Enforced in
// attachment.service.ts's uploadAttachment, server-side, after the shared
// ATTACHMENT_MAX_FILE_SIZE multer limit (middleware/multer.ts) has already
// run - not a replacement for it.
export const DEMO_ATTACHMENT_MAX_FILE_SIZE = 2 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",

  "image/jpeg",
  "image/png",
  "image/webp",

  "text/plain",

  "application/zip",
] as const;