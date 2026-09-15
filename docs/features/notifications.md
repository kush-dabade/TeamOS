# Notifications

## Notification model

A **`Notification`** belongs to one `Workspace` and is addressed to one `recipientId` (a `User`). Fields: `type` (see below), `title`, `message`, an optional `metadata` JSON blob, `isRead`/`readAt`, and soft deletion via `deletedAt`.

## Notification types

The `NotificationType` enum has five values, but only four are actually produced anywhere in the service layer — verified by searching every call site, not by reading the enum alone:

| Type | Triggered by |
|---|---|
| `INVITATION_RECEIVED` | `invitation.service.ts` — a workspace invitation is created |
| `TASK_ASSIGNED` | `task.service.ts` — a task is created or reassigned with an assignee other than the actor |
| `COMMENT_ON_ASSIGNED_TASK` | `comments.service.ts` — a comment is created on a task assigned to someone other than the commenter |
| `OWNERSHIP_TRANSFERRED` | `workspace.service.ts` — workspace ownership is transferred |
| `COMMENT_MENTIONED` | **Never triggered.** The enum value exists but no code path creates a notification of this type — there is no `@mention` parsing anywhere in comment handling. Do not treat this as an implemented mentions feature; see [`collaboration.md`](./collaboration.md#mentions). |

## Creation

Every notification in TeamOS today is created **exclusively through the BullMQ notification queue** — there is no direct-write path in application code. The triggering services (task, comment, invitation, workspace) all call `enqueueNotification(...)` (`queues/notification/notification.queue.ts`); the actual `prisma.notification.create` call, in `createNotification` (`notification.service.ts`), is only ever invoked from `notification.worker.ts` processing a `CREATE_NOTIFICATION` job. This keeps notification creation off the request's critical path and gets it BullMQ's retry/backoff for free.

## Queue behavior

- **Deterministic job IDs**: `create-notification-<recipientId>-<eventId>` — `eventId` is either the source entity's own id (a task's id for its one-time creation notification, a comment's id) or a version-tagged value for events that can repeat against the same entity (e.g. reassigning the same task again) — so retrying or double-enqueuing the same domain event can't create a duplicate notification.
- **Retries/backoff**: 5 attempts, exponential backoff starting at 1 second.
- **Retention**: completed jobs removed immediately; failed jobs kept up to 7 days or 1000 entries, whichever comes first.
- **Worker**: runs in the separate `worker` process (`backend/src/worker.ts`), not the API process.

## Realtime — a genuinely different mechanism than everywhere else

Most of TeamOS's realtime events are emitted directly, in-process, right after a Prisma write commits (see [`../architecture/system-design.md` §10](../architecture/system-design.md#10-realtime-architecture)). **`NOTIFICATION_CREATED` is not one of those** — it cannot be, because the process that actually creates the notification row is the *worker* process, which never initializes Socket.IO. Instead:

- `notification.events.ts` runs a BullMQ `QueueEvents` listener **inside the API process** (which does have the Socket.IO server), subscribed to the notification queue's `"completed"` event.
- When the worker finishes a `CREATE_NOTIFICATION` job, `QueueEvents` delivers that completion (with the job's return value — the created notification) to the API process, which then calls `emitToUser(recipientId, NOTIFICATION_CREATED, { notification })`.
- This is still database-first (the row is already committed by the time the job is reported "completed") and still best-effort (a failed emit here is logged and swallowed the same way, with the same fallback: the recipient sees it on their next normal fetch) — but the trigger is **cross-process job completion**, not an in-process function return, unlike task/project/sprint/comment/etc. events.

By contrast, `NOTIFICATION_READ` and `NOTIFICATION_READ_ALL` (marking notifications read) **are** ordinary in-process emits — `markNotificationAsRead`/`markAllNotificationsAsRead` in `notification.service.ts` call `emitToUser` directly after their own Prisma write, since those are synchronous HTTP mutations with no queue involved.

## API

- `GET /api/v1/notifications` — list the caller's notifications, **cursor**-paginated (`limit`, opaque `cursor`) — not offset-based, unlike tasks/comments/activity.
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/:notificationId/read`

Full request/response detail: [`../architecture/api-specification.md` §4](../architecture/api-specification.md#4-endpoint-reference), §6 for the pagination style.

## Authorization

Every endpoint above is implicitly scoped to `req.user.id` as the recipient — there is no endpoint that accepts another user's id, and no code path that returns another user's notifications.
