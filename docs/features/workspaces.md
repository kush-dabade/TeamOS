# Workspaces

## Workspace concept

A **`Workspace`** is TeamOS's tenant boundary. All application data lives in one shared PostgreSQL database; every workspace-scoped resource carries its own `workspaceId` and access is checked against the caller's membership in that specific workspace — there is no database-per-tenant separation and no PostgreSQL Row-Level Security. See [`../architecture/system-design.md` §7](../architecture/system-design.md#7-multi-tenancy) for the full isolation model.

Every workspace has exactly one accountable owner (`Workspace.ownerId`), separate from the general membership/role system described below.

## Workspace lifecycle

- **Create** (`POST /api/v1/workspaces`) — any authenticated user can create a workspace; the creator is inserted as its `OWNER` in the same transaction the workspace row is created in. The workspace's `slug` is generated from its name and made unique via a check-then-insert loop backed by a database `@unique` constraint (see [`../architecture/database-design.md` §6](../architecture/database-design.md#6-constraints-and-invariants) for the known, low-severity race in that generation step).
- **List/retrieve** (`GET /api/v1/workspaces`, `GET /api/v1/workspaces/:workspaceId`) — a user only ever sees workspaces they're a member of.
- **Rename** (`PATCH /api/v1/workspaces/:workspaceId`) — `OWNER` only.
- **Onboarding**: `WorkspaceGuard` (`frontend/src/features/workspaces/routes/workspace-guard.tsx`) redirects any authenticated user with zero workspace memberships to `/onboarding` rather than rendering the app shell — a new user is never dropped into a workspace-shaped UI with nothing in it.

## Membership

Membership is modeled by **`WorkspaceMember`**, unique on `(workspaceId, userId)` — one row per user per workspace, carrying exactly one role:

| Role | Notes |
|---|---|
| `OWNER` | Exactly one per workspace in practice — the account named in `Workspace.ownerId`. Can manage any other role, transfer ownership, rename the workspace. |
| `ADMIN` | Can manage `MEMBER`/`GUEST` roles and invitations, and most project/task/sprint actions, but cannot act on another `ADMIN` or the `OWNER`. |
| `MEMBER` | Full read/write on projects/tasks/comments/attachments within the workspace; cannot manage members, roles, or invitations, and cannot create/archive/transfer projects or sprints. |
| `GUEST` | Read-only on comments — explicitly blocked from creating, editing, or deleting comments (`comments.service.ts`), and not granted the `OWNER`/`ADMIN`-gated actions any `MEMBER` also lacks. |

## RBAC — the actual hierarchy

Membership changes and role assignment go through the same two hierarchy checks (`canManageMember`/`canAssignRole`, `workspace.service.ts`), derived directly from the code rather than a generic RBAC matrix:

- An `OWNER` may manage or assign any of `ADMIN`/`MEMBER`/`GUEST` (never another `OWNER`).
- An `ADMIN` may manage or assign only `MEMBER`/`GUEST` — an `ADMIN` cannot change another `ADMIN`'s role, remove another `ADMIN`, or promote anyone to `ADMIN`/`OWNER`.
- `MEMBER`/`GUEST` cannot manage any member.

`requireRole(membership, [...])` gates the specific write actions that need more than plain membership (project/sprint create-update-archive, invitations) — see [`../architecture/api-specification.md` §4](../architecture/api-specification.md#4-endpoint-reference) for exactly which endpoints require which role.

## Ownership

- **Workspace ownership** (`Workspace.ownerId`) is a single accountable user, distinct from the `OWNER` role — `transferWorkspaceOwnership` double-checks both (`workspace.ownerId === actorId` *and* the actor's `WorkspaceMember.role === OWNER`) before proceeding, so the two staying in sync is verified, not assumed.
- **Transfer** takes an explicit row lock (`SELECT ... FOR UPDATE` via `lockWorkspaceMembership`) on both the outgoing and incoming member rows as the first statements inside one `$transaction`, so a concurrent transfer or removal serializes against it rather than racing.
- **Project ownership** is separate again (`Project.ownerId`) — see [`projects-and-tasks.md`](./projects-and-tasks.md).

## Member removal / leaving

- **An `OWNER` cannot leave** their own workspace (`leaveWorkspace` throws a `ValidationError`) — ownership must be transferred first.
- **A member who owns any project cannot be removed** — `removeWorkspaceMember` counts that member's owned projects both before opening a transaction (fast-fail) and again after acquiring the same row lock `transferProjectOwnership` uses (authoritative against a concurrent transfer), rejecting the removal with a count-specific error message if any are found.
- **Task assignments are explicitly cleared**: removal runs `task.updateMany({ where: { workspaceId, assigneeId: removedUserId }, data: { assigneeId: null } })` inside the same transaction as the membership delete — a removed member never lingers as a task's assignee.
- **Realtime consequence**: both removal and voluntary leave delete the `WorkspaceMember` row and emit (`MEMBER_REMOVED`/`MEMBER_LEFT`) to the workspace room; removal additionally evicts the removed user's live sockets from that workspace's room (`evictFromWorkspace`) so an already-connected client stops receiving that workspace's events immediately, not just on its next reconnect. See [`../architecture/system-design.md` §10](../architecture/system-design.md#10-realtime-architecture).
- Both actions log an `Activity` row (`MEMBER_REMOVED`/`MEMBER_LEFT`).

## Tenant isolation

Workspace membership is the single gate every workspace-scoped read or write passes through: `requireWorkspaceMembership(workspaceId, userId)` is checked before a service touches any project/task/sprint/comment/attachment/notification/invitation, and the target `workspaceId` always comes from the URL or an already-loaded parent row, never a client-supplied claim. A non-member gets `403 FORBIDDEN`, not `404` — resource existence isn't hidden, only access is denied. Full detail: [`../architecture/system-design.md` §7](../architecture/system-design.md#7-multi-tenancy), [`../architecture/database-design.md` §4](../architecture/database-design.md#4-tenant-isolation), [`../architecture/api-specification.md` §5](../architecture/api-specification.md#5-tenant-and-authorization-rules).

## Frontend

- **`WorkspaceProvider`** establishes the active workspace context for everything rendered beneath it; **`WorkspaceGuard`** is the sole place that knows workspace membership is still resolving (loading/error/empty states), redirecting to `/onboarding` when the user has none — other components read the narrower, already-resolved `useActiveWorkspace()`.
- **Settings**: `WorkspaceSettingsPage` composes `WorkspaceDetailsCard`, `WorkspaceMembersCard` (role badges, remove/leave actions), and `WorkspaceInvitationsCard` (pending invitations, resend/cancel) — each with its own skeleton loading state.
- Creating a workspace (`create-workspace-form.tsx`) and inviting members (`invite-member-dialog.tsx`, `workspace-invite-form.tsx`) are both real, TanStack-Query-backed mutations against the endpoints above, not local/mock state.
