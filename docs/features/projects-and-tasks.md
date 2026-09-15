# Projects and Tasks

## Project model

A **`Project`** belongs to one `Workspace` and has one accountable owner (`ownerId`, a `User`). Its `slug` is unique **per workspace** (`@@unique([workspaceId, slug])`), not globally. `status` is one of `PLANNED | ACTIVE | COMPLETED | ARCHIVED`.

- **Archive/restore** (`POST /projects/:projectId/archive` / `/restore`, `OWNER`/`ADMIN` only) toggle `status` to/from `ARCHIVED` — this does not delete or cascade-change the project's tasks; it flips one flag that then blocks further modification (see below).
- **Ownership transfer** (`POST /projects/:projectId/transfer-ownership`, `OWNER`/`ADMIN`) reassigns `ownerId` to another workspace member. Unlike archive/restore, this is deliberately **not** blocked on an archived project — an archived project's ownership can still change hands even though its content can't.
- **Archived projects are immutable**: task creation, task assignee validation, comment create/edit/delete, and project update all check `project.status === "ARCHIVED"` and throw a `ValidationError` ("Archived projects cannot be modified") if so — enforced independently in each of those services, not by a single shared guard.

## Project workflow

The normal path is workspace → project → tasks: a member creates a project under their workspace, then creates tasks under that project. Projects have no pagination on their list endpoint (`GET /workspaces/:workspaceId/projects` returns the full list, with an optional `?status=` filter) — appropriate at the scale of "projects per workspace," unlike tasks.

## Task model

A **`Task`** carries three independent foreign keys — `workspaceId`, `projectId`, and an optional `sprintId` (see [`sprints.md`](./sprints.md) for how consistency between them is maintained at assignment time, since the schema itself doesn't enforce it). Also: `createdById` (required, `onDelete: Restrict` — a user who has created tasks can't be hard-deleted), an optional `assigneeId` (`onDelete: SetNull`), `status`, `priority`, `dueDate`, `completedAt`, and soft-delete via `deletedAt`.

## Task lifecycle

`status` is `TODO | IN_PROGRESS | REVIEW | DONE`; `priority` is `LOW | MEDIUM | HIGH | URGENT`. Both are updated via `PATCH /api/v1/tasks/:taskId` — there is no separate status-transition endpoint or state-machine restricting which status can follow which; any member can set `status` to any of the four values in one update. A transition to `DONE` sets `completedAt` (and emits `TASK_COMPLETED` rather than `TASK_UPDATED` — see below).

## Task creation

**New tasks always start at `TODO`.** `createTaskSchema` (`task.schema.ts`) has no `status` field at all — the body accepts `title` (required) plus optional `description`/`priority`/`dueDate`/`assigneeId`. This is a deliberate default, not a gap: the frontend's `TaskForm` correspondingly only renders a status control in its edit mode, not on create.

## Assignment

If `assigneeId` is supplied on create or update, the service validates it's an actual member of the task's workspace (`findWorkspaceMembership`) and rejects it with a `400 ValidationError` ("Assignee must be a workspace member") otherwise — this is a data-integrity check, not an authorization check (any member can assign a task to any other member; there's no additional role gate on assignment itself). Assigning a task to someone other than the actor enqueues a `TASK_ASSIGNED` notification (BullMQ, deduplicated by task id for creation and a version-tagged event id for reassignment — see [`notifications.md`](./notifications.md)).

## Project/task authorization

- Project create/update/archive/restore/transfer-ownership: `OWNER`/`ADMIN`.
- Task create/update/delete: any workspace member (no role gate beyond membership) — except that the *target project* must not be archived, and a `GUEST` is not otherwise restricted from tasks the way they are from comments (verified: no `WorkspaceRole.GUEST` check anywhere in `task.service.ts`).
- All task/project reads require workspace membership.

## Pagination and filtering

Verified directly against the actual Zod schemas, not assumed from the UI:
- **Projects**: no pagination — the full workspace project list is returned, with an optional `status` filter.
- **Tasks**: offset pagination (`page`, `limit`, max `limit` 100) on both `GET /projects/:projectId/tasks` and `GET /workspaces/:workspaceId/tasks`. `listTasksQuerySchema` is `.strict()` and accepts **only** `page`/`limit` — there is no server-side `status`/`priority`/`assigneeId` query filter today. Any such filtering visible in the UI happens client-side over the already-fetched page.

Full endpoint detail: [`../architecture/api-specification.md` §4](../architecture/api-specification.md#4-endpoint-reference).

## Realtime and activity

Project and task mutations each log an `Activity` row and emit a realtime event as the last step of their transaction, after commit (`PROJECT_CREATED/UPDATED/ARCHIVED/RESTORED/OWNERSHIP_TRANSFERRED`, `TASK_CREATED/UPDATED/COMPLETED/DELETED`) — verified directly in `project.service.ts` and `task.service.ts`. See [`collaboration.md`](./collaboration.md) for the activity feed and [`../architecture/system-design.md` §10](../architecture/system-design.md#10-realtime-architecture) for the realtime mechanism itself.

## Frontend architecture

Projects and tasks are fetched and mutated entirely through TanStack Query — list/detail hooks own the server-state cache, mutations invalidate the relevant query keys on success, and realtime events invalidate the same keys for other connected clients (`features/realtime/lib/realtime-handlers.ts`). There is no page-local mock data or hand-rolled fetch state in these features; `TaskForm`'s status control being edit-mode-only (see above) is an intentional UX decision, not leftover mock behavior.
