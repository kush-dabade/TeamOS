# Public Demo

## Purpose

TeamOS exposes a public, no-signup entry point (`/try`) so a visitor — a portfolio reviewer, an interviewer — can use the real, authenticated application immediately, without creating an account or waiting on email verification. It provisions a genuine, isolated tenant rather than a canned/fake walkthrough.

## User workflow

```text
anonymous visitor
→ GET /try (frontend)
→ POST /api/v1/demo/session
→ demo user + workspace + seed data provisioned
→ Better Auth session cookie issued
→ frontend refetches auth session, navigates to /dashboard
→ authenticated demo workspace, indistinguishable in the UI from a real one
  except for a persistent "Demo workspace" indicator
```

An already-authenticated real user who lands on `/try` is redirected straight to `/dashboard` instead — they don't get a second, unnecessary demo workspace.

## Provisioning

`provisionDemoSession` (`backend/src/modules/demo/demo.service.ts`), in order:

1. Generate a random email (`demo-<uuid>@teamos.local` — RFC 6761's reserved `.local` TLD, so it can never collide with or resolve to a real mailbox) and a random 24-byte password, neither ever exposed to the client.
2. `auth.api.signUpEmail` — creates a real Better Auth user.
3. A direct Prisma update marks that user `emailVerified: true`, `isDemo: true`, `demoExpiresAt` set `DEMO_SESSION_TTL_HOURS` (3 hours) out.
4. `createWorkspace` — a real workspace named `"Acme Inc."`, owned by that user (its slug is disambiguated from the permanent local-dev seed's own `"Acme Inc."` workspace and from other concurrent demo sessions by the normal unique-slug generation every workspace goes through).
5. `generateWorkspaceData` — populates it with seed data (see below).
6. **Only after all of the above succeed**, `auth.api.signInEmail` issues a real session, and its `Set-Cookie` header is copied onto the HTTP response.

**Session issuance is deliberately last.** Every earlier step can fail independently; until step 6 runs, nothing has ever been returned to any caller and nobody holds the randomly generated password, so a partial failure is simply an inert row — no separate rollback path exists or is needed. It is picked up and removed by the same TTL cleanup as a normal expired session (see below), whether it failed immediately or was used for the full 3 hours.

## Isolation

A demo tenant is an ordinary workspace/user pair in the same tables as everyone else's, subject to the exact same tenant-isolation rules described in [`../architecture/system-design.md` §7](../architecture/system-design.md#7-multi-tenancy) — there is no shared "demo mode" data pool and no special-cased query path. A demo tenant cannot see or affect any other tenant's data, demo or real.

## Restrictions

The only demo-specific restriction beyond normal RBAC:
- **Demo accounts cannot send workspace invitations**, regardless of role — `invitation.service.ts` checks `actor.isDemo` and rejects with a `ForbiddenError` before any role check runs. This closes the one abuse path a free, anonymous, high-signup-rate account type would otherwise open: using the real invitation pipeline to send email to arbitrary addresses.
- Attachments uploaded by a demo account are capped at 2MB instead of the normal 10MB (see [`attachments.md`](./attachments.md)) — a general demo-account restriction, not specific to the `/try` flow itself.

No other artificial restriction exists — a demo user can create/edit/delete projects, tasks, sprints, comments, and attachments (within the size limit above) exactly like a real member of that role.

## Rate limiting

`demoSessionLimiter`: 5 requests per 15 minutes per IP, mounted as the *first* middleware on `POST /api/v1/demo/session` — ahead of the controller, so an over-limit request never reaches the comparatively expensive provisioning work (a real signup, a workspace, and a full seed dataset). The 15-minute window (rather than a 60-second one) is deliberately sized to bound sustained scripted provisioning, not just burst volume.

## Expiration and cleanup

- Every demo user (the provisioned owner, and the ephemeral teammates seed data creates for them — see below) carries the same `demoExpiresAt`.
- A recurring BullMQ job (`demo-cleanup` queue, scheduled every 15 minutes via BullMQ's job scheduler) runs `cleanupExpiredDemoSessions` (`demo-cleanup.service.ts`) in the `worker` process: it finds every `User` where `isDemo = true AND demoExpiresAt <= now()` (capped at 200 per sweep, remainder picked up next run), deletes each one's owned workspace(s) first, then the user row itself.
- **Order matters and is deliberate**: several models (`Project.owner`, `Task.createdBy`, `Comment.author`, `Attachment.uploadedBy`) are `onDelete: Restrict` from `User` — a demo user can't be deleted while content they created still references them. Every one of those is cascade-deleted *from* `Workspace`, so deleting the owned workspace(s) first clears every reference; only then can the user row itself be deleted.
- Both delete steps use `deleteMany` (not `delete`), making the sweep idempotent — a session already cleaned up by an earlier or concurrent run simply matches zero rows instead of erroring; one user's cleanup failing is caught and logged without aborting the rest of the batch.

## Security

The response body from `POST /api/v1/demo/session` is deliberately minimal — `{ success: true, data: { expiresAt } }`. No user id, email, generated password, or session token is ever returned in JSON: the browser only needs the session cookie already attached to the response by the time it arrives, and returning the credentials themselves would serve no purpose while adding exposure.

## Frontend

`TryPage` (`frontend/src/features/demo/pages/TryPage.tsx`) auto-triggers provisioning on mount (guarded against React StrictMode's double-invoke in development, but not against a real user-initiated retry) once it has a definitive answer on prior auth state, showing `DemoProvisioningLoader` while pending and `DemoProvisioningError` (with a real retry action) on failure. On success, it explicitly `refetch()`s the auth session before navigating — `POST /demo/session` goes through the plain `apiClient` (axios), not Better Auth's own React client, so Better Auth's session store has no way to know about the new cookie on its own; skipping this refetch would bounce the newly-provisioned visitor straight back to `/login`. Once inside the app, `DemoIndicator` renders a persistent "Demo workspace · expires in …" pill with a relative countdown and a "Sign up" call to action, visible for the whole session — it disappears entirely (not just visually) for non-demo users.

## Seed data

`generateWorkspaceData` is shared by **both** the public `/try` flow and the permanent local-development seed (`prisma/seed.ts`) — which path it takes for team provisioning is decided by the workspace owner's own `isDemo` flag, not by which caller invoked it: a real (non-demo) owner gets a fixed, reproducible "invite and accept" team (the permanent local seed, meant to be stable across `prisma db seed` runs); a demo owner gets a fresh, throwaway team created directly as members, each also `isDemo`-flagged with the same `demoExpiresAt` so the cleanup sweep removes them too, not just the workspace owner.

Either way, the resulting workspace looks the same: a small "Acme Inc." team (an engineering lead plus backend/frontend engineers, a designer, and a product manager, plus one pending invitation in the permanent seed's case), several projects in different lifecycle states (e.g. an active "Website Redesign," alongside others covering mobile, launch, and internal-platform work), each with tasks spanning realistic statuses/priorities, sprints in different states, comments, and a handful of attachments — enough to demonstrate every feature in this document set without visiting an empty workspace.
