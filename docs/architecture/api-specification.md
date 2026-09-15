# TeamOS — API Specification

Written directly from the current route registration in `backend/src/app.ts` and each module's `*.routes.ts`/`*.controller.ts`/`*.schema.ts`. This documents the API surface a developer actually needs to work with it — it is not a generated, exhaustive dump of every route.

## 1. API Overview

- **Base path**: `/api/v1` for all application resources (mounted with `app.use("/api/v1", ...)` in `backend/src/app.ts`). Better Auth owns `/api/auth/*` separately (its own catch-all handler, not under `/api/v1`).
- **Versioning**: `v1` is the only version that exists; there is no version negotiation, deprecation policy, or `v2`.
- **Format**: JSON request and response bodies throughout (`express.json()`), except file upload endpoints, which take `multipart/form-data`, and the attachment download endpoint, which streams the raw file with a `Content-Disposition` header.
- **Authentication model**: session cookies (Better Auth), not JWT/Bearer tokens. The frontend's `apiClient` sends `withCredentials: true`; there is no `Authorization` header anywhere in this API.
- **Error handling**: every error response from a TeamOS `/api/v1` application route has the same shape, produced by the TeamOS error handler (see [§3](#3-response-and-error-conventions)). Better Auth's own `/api/auth/*` routes are not covered by this — they use Better Auth's own response format.

## 2. Authentication Model

Authentication itself is handled entirely by Better Auth under `/api/auth/*` (sign-up, sign-in, sign-out, session, email verification, password reset — see `docs/features/authentication.md` for the full flow). Every `/api/v1/*` route that needs an authenticated caller applies the `requireAuth` middleware explicitly (there is no single global gate) — it calls `auth.api.getSession(...)` against the request's session cookie and populates `req.user = { id, email, name }`, or throws `401 AUTH_REQUIRED`.

**Public (no `requireAuth`) `/api/v1` routes** — verified from the route files, not assumed:
- `POST /api/v1/demo/session` (public demo provisioning)
- `GET /api/v1/invitations/token/:token` (invitation preview, so an invitee can see what they're being invited to before creating an account)

Every other `/api/v1/*` route requires a valid session. Authorization beyond "is this a valid session" (workspace membership, role, ownership) is a separate, per-endpoint concern — see [§5](#5-tenant-and-authorization-rules).

## 3. Response and Error Conventions

**Success** — a direct resource response, not a generic envelope wrapper beyond a `success`/`data` pair:
```json
{ "success": true, "data": { /* resource or { <plural>: [...] } for lists */ } }
```
List endpoints that paginate additionally include a top-level `pagination` object alongside `data` (shape depends on the pagination style — see [§6](#6-pagination-and-filtering)).

**Error** — for every `/api/v1` application route, always:
```json
{ "success": false, "error": { "code": "STRING_CODE", "message": "Human-readable message" } }
```
produced by one central `errorHandler` (`backend/src/middleware/error-handler.ts`) regardless of what actually threw within that route's request handling — a typed domain error, a Zod validation error, a Prisma constraint violation, a Multer upload error, a `BetterAuthAPIError` surfaced through `requireAuth`'s own `auth.api.getSession()` call, or a malformed/oversized request body. There is no separate error envelope per `/api/v1` module.

**This does not apply to `/api/auth/*`.** Better Auth's `toNodeHandler` responds to its own routes directly, in Better Auth's own format — verified against the test suite, e.g. `backend/tests/security/password-reset.test.ts` asserts `res.body.code` (a top-level `code` field, not `error.code`) on an invalid-token response. Do not assume a `/api/auth/*` error response uses the `{ success, error }` shape above.

**Status codes actually in use**: `200`/`201` (success), `400` (`VALIDATION_ERROR` — bad input or malformed JSON), `401` (`AUTH_REQUIRED`), `403` (`FORBIDDEN`), `404` (`NOT_FOUND`), `409` (`CONFLICT` — duplicate slug/name, an already-active sprint, a Prisma unique-constraint violation), `413` (`PAYLOAD_TOO_LARGE`), `429` (`RATE_LIMITED`, with a `Retry-After` header).

## 4. Endpoint Reference

Grouped by module. `requireAuth` on every row below except the two public routes noted in [§2](#2-authentication-model).

### Authentication (`/api/auth/*`, Better Auth — not `/api/v1`)
Standard Better Auth routes: `POST /sign-up/email`, `POST /sign-in/email`, `POST /sign-out`, `GET /get-session`, `POST /send-verification-email`, `GET /verify-email`, `POST /request-password-reset`, `POST /reset-password`, plus session/account management routes Better Auth registers itself. Not individually re-documented here — see `docs/features/authentication.md` for the flow and `backend/src/lib/auth.ts` for the exact configuration (session lifetime, email verification requirement, rate limits on the sign-in/sign-up/verification/reset paths).

### User / Profile (`/api/v1/users`)
| Method & Path | Purpose | Notes |
|---|---|---|
| `POST /me/avatar` | Upload/replace the caller's own avatar | `avatarLimiter` (10/min) + `uploadSingleAvatar` (multipart, 5MB max, JPEG/PNG/WebP only) ahead of the handler. Storage key is always derived server-side from the authenticated user's own id — never client-supplied. |
| `GET /me/avatar` | Stream the caller's own avatar | 404 if none set. |
| `DELETE /me/avatar` | Delete the caller's own avatar | |
| `GET /:id/avatar` | Stream another user's avatar (e.g. in a member list) | Read-only; still requires the caller to be authenticated, but there is no workspace-membership check tying this to a shared workspace — any authenticated user can view any other user's avatar by id. |

**Why avatars can't be set via `POST /api/auth/update-user` or `/api/auth/sign-up/email`**: those two generic Better Auth paths reject any request body containing an `image` field at all (`AVATAR_IMAGE_PROTECTED_PATHS` in `lib/auth.ts`) — this is what closes a cross-user avatar IDOR (planting another user's real storage key onto your own account, then reading/deleting it via the endpoints above). See `docs/features/authentication.md`.

### Workspaces (`/api/v1/workspaces`)
| Method & Path | Purpose | Authorization |
|---|---|---|
| `POST /` | Create a workspace (caller becomes `OWNER`) | Any authenticated user |
| `GET /` | List the caller's workspaces | Any authenticated user |
| `GET /:workspaceId` | Get one workspace | Member |
| `PATCH /:workspaceId` | Rename a workspace | `OWNER` only |
| `GET /:workspaceId/members` | List members | Member |
| `PATCH /:workspaceId/members/:memberId` | Change a member's role | Role-hierarchy checked: an `OWNER` may set any non-`OWNER` role; an `ADMIN` may only set `MEMBER`/`GUEST` — neither can act on a peer or superior role. |
| `DELETE /:workspaceId/members/:memberId` | Remove a member | Same hierarchy as above; also evicts the removed member's live sockets from the workspace room ([`system-design.md` §10](./system-design.md#10-realtime-architecture)). |
| `POST /:workspaceId/leave` | Leave a workspace | Member (an `OWNER` cannot leave without transferring ownership first) |
| `POST /:workspaceId/transfer-ownership` | Transfer ownership to another member | `OWNER` only; takes a row lock on both memberships inside one transaction. |

### Invitations
| Method & Path | Purpose | Authorization |
|---|---|---|
| `POST /api/v1/workspaces/:workspaceId/invitations` | Invite by email | `OWNER`/`ADMIN`; `invitationLimiter` (10/min); demo accounts are explicitly forbidden from sending invitations regardless of role. Same role-hierarchy rule as member-role changes applies to the invited role. |
| `GET /api/v1/workspaces/:workspaceId/invitations` | List a workspace's invitations | `OWNER`/`ADMIN` |
| `POST /api/v1/workspaces/:workspaceId/invitations/:invitationId/resend` | Resend | `OWNER`/`ADMIN`; same rate limiter |
| `DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId` | Cancel | `OWNER`/`ADMIN` |
| `GET /api/v1/invitations/token/:token` | Preview an invitation by its token | **Public** — no `requireAuth` |
| `POST /api/v1/invitations/token/:token/accept` | Accept by token (post-signup landing) | Authenticated; email on the session must match the invitation's target email |
| `POST /api/v1/invitations/token/:token/decline` | Decline by token | Authenticated |
| `GET /api/v1/invitations` | List invitations addressed to the caller's own email | Authenticated |
| `POST /api/v1/invitations/:invitationId/accept` | Accept (already-known id) | Authenticated |
| `POST /api/v1/invitations/:invitationId/decline` | Decline | Authenticated |

### Projects (`/api/v1/workspaces/:workspaceId/projects`, `/api/v1/projects/:projectId`)
| Method & Path | Purpose | Authorization |
|---|---|---|
| `POST /api/v1/workspaces/:workspaceId/projects` | Create | `OWNER`/`ADMIN` |
| `GET /api/v1/workspaces/:workspaceId/projects` | List (optional `?status=` filter) | Member. **No pagination** — returns the workspace's full project list. |
| `GET /api/v1/projects/:projectId` | Get one | Member of the project's workspace |
| `PATCH /api/v1/projects/:projectId` | Update | `OWNER`/`ADMIN` |
| `POST /api/v1/projects/:projectId/archive` | Archive | `OWNER`/`ADMIN` |
| `POST /api/v1/projects/:projectId/restore` | Restore from archived | `OWNER`/`ADMIN` |
| `POST /api/v1/projects/:projectId/transfer-ownership` | Change the project's owner | `OWNER`/`ADMIN` |

### Tasks (`/api/v1/projects/:projectId/tasks`, `/api/v1/workspaces/:workspaceId/tasks`, `/api/v1/tasks/:taskId`)
| Method & Path | Purpose | Authorization |
|---|---|---|
| `POST /api/v1/projects/:projectId/tasks` | Create | Member of the project's workspace. Body: `title`, optional `description`/`priority`/`dueDate`/`assigneeId` — **no `status`**; every new task starts at `TODO` server-side, by design. |
| `GET /api/v1/projects/:projectId/tasks` | List a project's tasks, paginated (`page`, `limit`, max `limit` 100) | Member |
| `GET /api/v1/workspaces/:workspaceId/tasks` | List a workspace's tasks across all projects, same pagination | Member |
| `GET /api/v1/tasks/:taskId` | Get one | Member |
| `PATCH /api/v1/tasks/:taskId` | Update (`title`/`description`/`status`/`priority`/`dueDate`/`assigneeId`) | Member |
| `DELETE /api/v1/tasks/:taskId` | Delete (soft-delete via `deletedAt`) | Member |

**Verified, not assumed**: the two list endpoints' query schema (`listTasksQuerySchema`) is `.strict()` and accepts **only `page` and `limit`** — there is no server-side `status`/`priority`/`assigneeId` filter on these endpoints today; any such filtering happening in the UI is client-side over the already-fetched page.

### Comments (`/api/v1/tasks/:taskId/comments`, `/api/v1/comments/:commentId`)
| Method & Path | Purpose |
|---|---|
| `POST /api/v1/tasks/:taskId/comments` | Create |
| `GET /api/v1/tasks/:taskId/comments` | List, paginated (`page`/`limit`) |
| `PATCH /api/v1/comments/:commentId` | Update — **author only** (`comment.authorId !== actorId` → `403 FORBIDDEN`, no role-based override) |
| `DELETE /api/v1/comments/:commentId` | Soft-delete — **author OR workspace `OWNER`/`ADMIN`** (`comment.authorId === actorId \|\| membership.role === ADMIN \|\| membership.role === OWNER`) |

All require workspace membership; `GUEST` cannot create, edit, or delete comments regardless of authorship. See `docs/features/collaboration.md` for the full comment authorization model.

### Attachments (`/api/v1/tasks/:taskId/attachments`, `/api/v1/attachments/:attachmentId`)
| Method & Path | Purpose | Notes |
|---|---|---|
| `POST /api/v1/tasks/:taskId/attachments` | Upload | `uploadLimiter` (10/min) + `uploadSingleAttachment` (multipart, 10MB max — 2MB for demo accounts — fixed MIME allow-list: PDF, JPEG/PNG/WebP, plain text, zip) |
| `GET /api/v1/tasks/:taskId/attachments` | List a task's attachments | |
| `GET /api/v1/attachments/:attachmentId` | Download (streams the file, sets `Content-Disposition`) | |
| `DELETE /api/v1/attachments/:attachmentId` | Delete | |

All require membership in the attachment's/task's workspace — see `docs/features/attachments.md` for the storage-key/authorization details.

### Sprints (`/api/v1/projects/:projectId/sprints`, `/api/v1/sprints/:sprintId`, `/api/v1/sprints/:sprintId/tasks`)
| Method & Path | Purpose | Authorization |
|---|---|---|
| `POST /api/v1/projects/:projectId/sprints` | Create | `OWNER`/`ADMIN` |
| `GET /api/v1/projects/:projectId/sprints` | List | Member |
| `GET /api/v1/sprints/:sprintId` | Get one | Member |
| `PATCH /api/v1/sprints/:sprintId` | Update | `OWNER`/`ADMIN` |
| `POST /api/v1/sprints/:sprintId/start` | Start (sets `status: ACTIVE`) | `OWNER`/`ADMIN`. Can return `409 CONFLICT` if another sprint in the same project is already active — enforced by a database partial unique index, not just the pre-check (see `database-design.md` §6). |
| `POST /api/v1/sprints/:sprintId/complete` | Complete | `OWNER`/`ADMIN` |
| `POST /api/v1/sprints/:sprintId/tasks/:taskId` | Assign a task to the sprint | Member |
| `DELETE /api/v1/sprints/:sprintId/tasks/:taskId` | Remove a task from the sprint | Member |
| `GET /api/v1/sprints/:sprintId/tasks` | List a sprint's tasks | Member |

### Activity (`/api/v1/workspaces/:workspaceId/activity`)
| Method & Path | Purpose | Authorization |
|---|---|---|
| `GET /api/v1/workspaces/:workspaceId/activity` | List, paginated (`page`/`limit`) | Member |

Read-only — activity rows are written internally by other modules' services, never through a public write endpoint.

**Filtering** (`listActivitiesQuerySchema`, `.strict()`): beyond `page`/`limit`, the endpoint accepts one optional filter shape — `taskId`, `projectId`, or an `(entityType, entityId)` pair — used by the frontend's per-task and per-project activity views, not just a flat workspace feed. Two rules are enforced by the schema itself: `entityType` and `entityId` must be supplied together (one without the other is rejected), and at most one of the three filter shapes (`taskId` / `projectId` / `entityType`+`entityId`) may be supplied per request — combining them is rejected, not silently merged.

### Notifications (`/api/v1/notifications`)
| Method & Path | Purpose |
|---|---|
| `GET /` | List the caller's notifications, **cursor**-paginated (`limit` max 50, opaque `cursor`) |
| `GET /unread-count` | Unread count |
| `PATCH /read-all` | Mark all read |
| `PATCH /:notificationId/read` | Mark one read |

Always scoped to the authenticated caller (`recipientId`) — there is no endpoint to read another user's notifications.

### Search (`/api/v1/search`)
| Method & Path | Purpose |
|---|---|
| `GET /?q=&workspaceId=&limit=` | Cross-entity search within one workspace | `searchLimiter` (20/min — the most DB-expensive read path). `q` must be 2–100 characters; `workspaceId` must be a valid cuid the caller is a member of; `limit` defaults to 10, max 50. |

### Demo (`/api/v1/demo`)
| Method & Path | Purpose |
|---|---|
| `POST /session` | Provision a public, isolated demo tenant and sign the caller in | **Public — no `requireAuth`.** `demoSessionLimiter` (5 per 15 min per IP) runs first, ahead of the expensive provisioning work. |

Full detail in [§8](#8-demo-api).

## 5. Tenant and Authorization Rules

> Resource access is authorized against the authenticated user's workspace membership and the server-derived workspace context — never a client-supplied workspace id or role claim.

Workspace-scoped service operations resolve the target resource's `workspaceId` (from the URL directly, or from the parent row already loaded — e.g. a task's own `workspaceId` column) and enforce membership — via `requireWorkspaceMembership(workspaceId, userId)` — before allowing the operation to proceed; a non-member gets `403 FORBIDDEN`. Beyond plain membership, `requireRole(membership, [...])` gates the actions in the tables above marked `OWNER`/`ADMIN`. This was verified directly in the endpoints documented above, not mechanically proven across every route — full detail in `system-design.md` §6–7.

## 6. Pagination and Filtering

**Two distinct, verified pagination styles coexist — do not assume one applies where the other is used:**
- **Offset-based** (`page`, `limit`, response includes `pagination: { page, limit, total, pages }`): tasks, comments, activity.
- **Cursor-based** (`limit`, opaque `cursor`, response includes a `pagination` object carrying the next cursor): notifications.
- **No pagination at all**: projects (`GET /workspaces/:workspaceId/projects` returns the full list, with an optional `status` filter).

Filtering beyond that: projects support `?status=`; search supports `?q=`; task list endpoints support **no** query-param filtering beyond `page`/`limit` (see [§4](#4-endpoint-reference)'s Tasks section — verified against the actual `.strict()` Zod schema, not assumed from the UI).

## 7. Realtime Side Effects

Mutations that have realtime consumers emit the corresponding realtime event **after** their database write commits. This was verified directly across the project, task, sprint, sprint-task (assign/remove), comment, attachment, workspace membership, invitation, activity, and notification services — not every conceivable mutation necessarily has a realtime event, only the ones a connected client actually needs to react to:

```text
mutation → Prisma write (transaction where needed) → commit → emitToWorkspace/emitToUser → connected clients' TanStack Query invalidation → refetch
```

Verified directly in the relevant service files (`comments.service.ts`, `project.service.ts`, `task.service.ts`, `sprint.service.ts`, `sprint-task.service.ts`, `attachment.service.ts`, `activity.service.ts`, `workspace.service.ts`, `invitation.service.ts`) — the emit call is always the last statement, after the write is already durable. **`notification.service.ts` only follows this exact in-process shape for `NOTIFICATION_READ`/`NOTIFICATION_READ_ALL`** (its own synchronous mutations); the notification-creation event, `NOTIFICATION_CREATED`, is emitted differently — via a BullMQ `QueueEvents` bridge in a separate file, because the row itself is created by the worker process, which has no Socket.IO server of its own. See `system-design.md` §10 for the full event list, room-isolation guarantee, and that bridge's mechanism. Realtime emission is best-effort and is not the source of truth for persistence: an emission failure is logged, not surfaced as a failed request — it never turns an already-committed domain mutation into a failed operation.

## 8. Demo API

`POST /api/v1/demo/session` (`backend/src/modules/demo/demo.controller.ts` → `demo.service.ts`'s `provisionDemoSession`):

- **Unauthenticated access**: deliberately no `requireAuth` — this is the entire point (an anonymous visitor gets a working account with no signup form).
- **Rate limiting**: `demoSessionLimiter`, 5 requests per 15 minutes per IP, mounted ahead of the controller — an over-limit request never reaches the (comparatively expensive) provisioning work.
- **Provisioning**: creates a *real* Better Auth user (randomly generated email `demo-<uuid>@teamos.local` and password, never returned to the client), marks it `emailVerified: true` and `isDemo: true` with `demoExpiresAt` set 3 hours out, creates a real workspace named `"Acme Inc."` that user owns, and populates it with realistic seed data (projects, tasks, sprints, comments) via `generateWorkspaceData`.
- **Session issuance is deliberately the last step**: every prior step (signup, the demo-flag update, workspace creation, data generation) can fail independently; only once all of them succeed does the handler call `auth.api.signInEmail` and copy its real `Set-Cookie` header(s) onto the response. A partially-provisioned failure is simply inert — nothing can ever authenticate as it — and gets swept up by the same TTL cleanup as a normal expired demo session, with no separate rollback path needed.
- **Isolation**: the provisioned account and workspace are ordinary rows in the same tables as real users/workspaces, subject to the exact same tenant-isolation rules — a demo tenant cannot see or affect any other tenant's data, demo or real. Demo accounts are explicitly blocked from one specific cross-tenant-adjacent action: sending workspace invitations (checked in `invitation.service.ts`, regardless of role).
- **TTL cleanup**: a scheduled BullMQ job (`demo-cleanup` queue/worker) sweeps `User` rows where `isDemo = true AND demoExpiresAt <= now()` and deletes them (workspace before user, respecting the `Restrict` foreign keys elsewhere in the schema) — see `docs/features/demo.md`.
- **Response body is deliberately minimal**: `{ success: true, data: { expiresAt } }` — no user id, email, password, or session token is ever returned in JSON; the browser only needs the cookie already applied to the response.

## 9. API Security Expectations

- **Authentication**: session cookie via Better Auth, verified per-route via `requireAuth` (or the socket-handshake equivalent for realtime) — no JWT.
- **Authorization**: workspace membership + role, checked server-side in the service layer on every workspace-scoped endpoint ([§5](#5-tenant-and-authorization-rules)).
- **Validation**: Zod, per-module, parsed in the controller before the service ever runs; several list-query schemas are `.strict()`, rejecting unexpected query parameters outright rather than silently ignoring them.
- **Tenant isolation**: every application-domain tenant-owned resource carries its own `workspaceId`, checked before any read or write (`system-design.md` §7).
- **Rate limiting**: tiered by actual cost/risk — general (300/min), search (20/min), uploads/avatars/invitations (10/min), demo provisioning (5/15min/IP), plus auth-specific limiters on sign-in/sign-up/verification/reset. Fails open on a Redis outage across the board, a deliberate, consistent tradeoff.
- **Upload controls**: fixed MIME allow-lists and size ceilings (attachments, avatars), enforced at both the Multer and service layers; every stored file is addressed only by a server-generated `storageKey`.
- **Error handling**: internal error detail (stack traces, query text, file paths) is logged server-side only — every client-facing error body is one of the fixed `{ code, message }` pairs in [§3](#3-response-and-error-conventions).
