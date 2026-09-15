# Sprints

## Sprint model

A **`Sprint`** belongs to one `Workspace` and one `Project`. Fields: `name` (unique per project, `@@unique([projectId, name])`), optional `goal`, `status` (`PLANNED | ACTIVE | COMPLETED`), and optional `startDate`/`endDate`. Tasks relate to a sprint via `Task.sprintId` — see [§ Sprint/task relationship](#sprinttask-relationship) below.

## Sprint lifecycle

Strictly one-directional, with each transition re-validated server-side, not just gated by the initial role check:

- **Create** (`POST /projects/:projectId/sprints`) — starts at `PLANNED`.
- **Start** (`POST /sprints/:sprintId/start`) — only permitted `if (sprint.status !== "PLANNED")` fails with a `ValidationError`; sets `status: "ACTIVE"`.
- **Complete** (`POST /sprints/:sprintId/complete`) — only permitted from `ACTIVE`; sets `status: "COMPLETED"`. Completing a sprint does not touch its tasks' `sprintId` or `status` — tasks keep their sprint assignment and whatever status they were already in.

There is no "cancel" or "reopen" transition, and archived projects block all of create/update/start/complete the same way they block task/comment mutation elsewhere (`ValidationError`, "Archived projects cannot be modified").

## One active sprint invariant

TeamOS guarantees **at most one `ACTIVE` sprint per project**, and does so with two layered mechanisms, not one:

1. **Application pre-check**: `startSprint` queries for an existing active sprint on the same project (`findActiveSprintByProject`) and rejects the request with a `409`-mapped `ValidationError` if one exists.
2. **Database enforcement**: a hand-authored **partial unique index**, `Sprint_projectId_active_unique` on `Sprint(projectId) WHERE status = 'ACTIVE'` (migration `20260819130000_add_sprint_active_partial_unique_index`). This exists specifically because the pre-check alone is a check-then-write: two concurrent `startSprint` calls for the same project can both pass step 1 before either commits. The partial index is what actually decides the outcome — only one of the two competing `UPDATE ... SET status = 'ACTIVE'` statements can succeed; the other fails with Postgres error `P2002`, which the service translates (`isProjectIdUniqueViolation`, matched by the constraint's specific columns, not just the error code) back into the same `ValidationError` a client would see from the pre-check, so the failure shape is consistent regardless of which layer caught it.

This is not expressible in Prisma's schema DSL (`@@unique` has no `WHERE` clause) — it exists only as raw SQL in the migration, built `CONCURRENTLY` so it doesn't hold a long lock against concurrent writes to `Sprint`. Full detail, including the migration's own documented recovery procedure if the `CONCURRENTLY` build is ever interrupted: [`../architecture/database-design.md` §6](../architecture/database-design.md#6-constraints-and-invariants).

## Sprint/task relationship

**There is no `SprintTask` database table.** A task's sprint membership is the direct `Task.sprintId` foreign key (nullable, `onDelete: SetNull` — deleting a sprint un-assigns its tasks rather than deleting them). The `sprint-task` backend module manages that field via two endpoints:

- `POST /sprints/:sprintId/tasks/:taskId` — assign
- `DELETE /sprints/:sprintId/tasks/:taskId` — remove

Both require workspace membership (no additional role gate — any member can (re)assign tasks to a sprint). Because `Task.workspaceId`/`projectId`/`sprintId` are three **independent** foreign keys with no composite database constraint tying them together, `sprint-task.service.ts` checks consistency itself before writing: `task.workspaceId !== sprint.workspaceId` and `task.projectId !== sprint.projectId` are both explicitly rejected. This is the application-level mechanism — not a database guarantee — that keeps a task's sprint always belonging to the same project (and workspace) as the task itself.

## Authorization

| Action | Requirement |
|---|---|
| Create, update, start, complete | `OWNER`/`ADMIN` |
| Assign task to sprint / remove task from sprint | Any workspace member |
| Read (get/list sprint, list sprint tasks) | Any workspace member |

## Realtime and activity

Every sprint lifecycle action and every sprint-task assignment/removal logs an `Activity` row and emits a realtime event after commit — `SPRINT_CREATED/UPDATED/STARTED/COMPLETED` (`sprint.service.ts`) and `TASK_ASSIGNED_TO_SPRINT`/`TASK_REMOVED_FROM_SPRINT` (`sprint-task.service.ts`) — verified directly in both service files, following the same database-first emission pattern as every other module (see [`../architecture/system-design.md` §10](../architecture/system-design.md#10-realtime-architecture)).

## Frontend

The sprint feature is fully implemented in the frontend, not a placeholder: `SprintsView`/`SprintsTable` list a project's sprints, `SprintForm`/`SprintFormPanel` handle create/update, `SprintPreviewPanel` shows detail, `SprintStatusBadge` reflects the three real statuses, and `AssignTaskCommand` + `SprintTaskList`/`SprintTaskItem` drive the task-assignment flow — all backed by TanStack Query against the endpoints above, not local mock state.
