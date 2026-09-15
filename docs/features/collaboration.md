# Collaboration

This document covers TeamOS's collaboration surface: task comments, the activity feed, and the realtime layer that keeps both (and everything else) live across connected clients.

## Comments

A **`Comment`** belongs to one `Task` (and, redundantly for query efficiency, the same `Workspace`), authored by one `User`, soft-deleted via `deletedAt`.

- **Create** (`POST /tasks/:taskId/comments`) and **list** (`GET /tasks/:taskId/comments`, offset-paginated) require workspace membership.
- **Edit** (`PATCH /comments/:commentId`) is **author-only** — `comment.authorId !== actorId` is rejected with `403 FORBIDDEN`, with no role-based override.
- **Delete** (`DELETE /comments/:commentId`) is **author OR workspace `OWNER`/`ADMIN`** — a moderation capability update does not have: `canDelete = comment.authorId === actorId || membership.role === ADMIN || membership.role === OWNER`.
- **`GUEST` cannot create, edit, or delete comments at all** — checked explicitly and independently in each of `createComment`/`updateComment`/`deleteComment` (`ForbiddenError`, "Guests cannot create/edit/delete comments"), before the author/role checks above even run.
- Comments on a task under an **archived project cannot be created, edited, or deleted** (`ValidationError`, "Archived projects cannot be modified") — the same guard used elsewhere for archived-project immutability.
- Creating a comment on a task assigned to someone other than the actor enqueues a `COMMENT_ON_ASSIGNED_TASK` notification for that assignee (see [`notifications.md`](./notifications.md)).

## Activity

**`Activity`** is an append-only log — there is no public write endpoint; every row is created internally by the service that performed the action (`createActivity`, `activity/activity.service.ts`), called from the project, task, sprint, sprint-task, comment, attachment, workspace, and invitation services. Each row records a `workspaceId`, an `actorId`, an `ActivityType` (e.g. `TASK_STATUS_CHANGED`, `MEMBER_REMOVED`, `SPRINT_STARTED`, `COMMENT_CREATED` — see `schema.prisma`'s `ActivityType` enum for the full list), an `entityType`/`entityId`, optional `taskId`/`projectId` (both `onDelete: SetNull`, so an activity record outlives the entity it described), and a `metadata` JSON blob with human-readable context (e.g. the task's title at the time, so the feed still reads sensibly after the task itself changes further).

**Reading**: `GET /workspaces/:workspaceId/activity` is workspace-scoped and offset-paginated, but is not *only* a flat workspace feed — its query schema (`listActivitiesQuerySchema`) also accepts an optional, mutually-exclusive filter: `taskId`, `projectId`, or an `(entityType, entityId)` pair (validated together — supplying more than one of these three filter shapes at once is rejected). This is what backs the frontend's per-task and per-project activity views (`use-task-activity.ts`/`use-project-activity.ts`), not just a workspace-wide feed.

## Realtime

Socket.IO, attached to the same HTTP server as the API. Full mechanism is documented in [`../architecture/system-design.md` §10](../architecture/system-design.md#10-realtime-architecture) — summarized here for the collaboration-relevant pieces:

- **Handshake authentication**: the same session-cookie check as `requireAuth`.
- **Server-derived rooms**: a socket joins `user:<userId>` and one `workspace:<workspaceId>` room per workspace the caller is *actually* a member of (queried live, not client-asserted) — this is what makes workspace isolation for realtime events a structural guarantee rather than a filtering step.
- **Member eviction**: removing a `WorkspaceMember` row actively evicts that user's live sockets from the now-stale workspace room, rather than waiting for their next reconnect.
- **Session revocation**: sign-out/password-reset disconnects the affected user's sockets outright.
- **Database-first emission**: every emit happens after the triggering write has already committed — an emit failure is logged, never rolled back into or reported as a failed request.
- **Frontend consumption**: `features/realtime/lib/realtime-handlers.ts` maps each event to a TanStack Query `invalidateQueries` call — comments, activity, tasks, sprints, memberships, and notifications are all handled this way. The frontend never manually patches cache state from a realtime payload; every affected client (including the one that made the original request) treats the event the same way: invalidate, then refetch from the server.

## Mentions

**Not implemented as a feature.** The `NotificationType` enum does contain a `COMMENT_MENTIONED` value, but it is never referenced anywhere in the service layer — no code path creates a notification of that type. Comment content is plain text with no `@mention` parsing, and there is no mentions UI. This is documented here precisely so it isn't mistaken for a working feature: the enum value exists, but nothing produces it.
