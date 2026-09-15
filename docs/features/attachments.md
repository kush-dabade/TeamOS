# Attachments

## Overview

Attachments belong to a `Task` (and, for query efficiency, redundantly carry the same `workspaceId`). There is no attachment concept independent of a task — no workspace-level or project-level attachment library.

## Upload

`POST /api/v1/tasks/:taskId/attachments`, `multipart/form-data`, one file per request:

- **Rate limit**: `uploadLimiter`, 10 requests/minute/user, ahead of the Multer parsing step.
- **Size**: 10MB for real users; **2MB for demo accounts** — enforced in `uploadAttachment` itself (`validateDemoAttachmentSize`), *after* the shared 10MB Multer limit has already run, not a replacement for it. This bounds a free, anonymous demo identity from being usable as unrestricted file storage.
- **MIME allow-list**: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `text/plain`, `application/zip` — anything else is rejected before the file is ever written to storage.
- **Authorization**: workspace membership required; `GUEST` is explicitly blocked (`ForbiddenError`, "Guests cannot upload attachments"); the task's project must not be archived.
- **Storage key**: always **server-generated** — `generateStorageKey` produces a fresh `cuid2` filename (only the original file's extension is preserved), it is never derived from or influenced by client input. The upload response and the database row both carry this key; the original filename is preserved separately (`originalName`) purely for display and download purposes.

## Storage abstraction

A small `StorageProvider` interface (`storage/storage.interface.ts`) sits in front of one real implementation:

- **`LocalStorageProvider`** — the only implemented provider. Files live under a configured root directory, backed by a named Docker volume (`uploads-data`) so uploads survive container restarts. Every read/write/delete/exists call resolves the requested storage key to an absolute path through an explicit boundary check (`resolveAbsolutePath`) that rejects any path resolving outside the root — this is what prevents path traversal via a crafted storage key, and it doesn't rely on the key being server-generated alone.
- **`S3StorageProvider` is intentionally not implemented.** It is a literal empty class; selecting the `s3` storage driver throws `"S3 storage provider is not implemented yet."` at the factory level rather than silently misbehaving. Do not treat S3 as available, partially working, or production-ready — it is a deferred stub.
- Files are namespaced by directory per use: attachments under `workspaces/<workspaceId>/tasks/<taskId>/`, avatars (a separate, unrelated upload path — see [`authentication.md`](./authentication.md#avatar-protection)) under `users/<userId>/avatar/`.

## Download

`GET /api/v1/attachments/:attachmentId` streams the file directly, setting a `Content-Disposition` header built from the attachment's original filename via `buildAttachmentContentDisposition` — which strips/escapes anything outside safe printable ASCII (including control characters that would otherwise break the header or throw in Node) and separately encodes a UTF-8 `filename*` parameter per RFC 5987/6266, so non-ASCII original filenames are preserved for clients that support it and degrade safely for those that don't. Authorization is workspace membership on the attachment's task — the same check as every other attachment operation.

## Delete

`DELETE /api/v1/attachments/:attachmentId` — workspace membership required, `GUEST` blocked, archived-project guard applies. **Not** author-only: any non-`GUEST` member can delete any attachment on a task they can access — there is no "uploader or admin" restriction the way comments distinguish edit (author-only) from delete (author-or-admin). The database row and its `Activity` record are deleted/created atomically in one transaction; the actual file removal from storage happens only after that transaction commits (logged best-effort — a storage-level failure, including the file already being gone, never blocks or rolls back the database deletion).

## Tenant isolation

Every attachment operation resolves the target task's `workspaceId` and calls `requireWorkspaceMembership` before proceeding — there is no attachment-specific bypass of the standard tenant-isolation model. See [`../architecture/system-design.md` §7](../architecture/system-design.md#7-multi-tenancy).

## Security

Controls actually implemented — no antivirus scanning or content inspection exists, and this document does not claim it does:
- Fixed MIME allow-list, checked server-side regardless of the client-reported `Content-Type`.
- Independent size ceilings for real vs. demo accounts, enforced at two layers (Multer, then service).
- Server-generated, unguessable storage keys — the client never supplies or influences one.
- Path-boundary enforcement on every local filesystem operation.
- Workspace membership + role check on upload/download/delete, consistent with the rest of the API.
