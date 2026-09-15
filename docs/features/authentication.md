# Authentication

## Overview

TeamOS authenticates users with **Better Auth** (`backend/src/lib/auth.ts`), using **session cookies** — there is no JWT, no Bearer token, and no OAuth provider configured. The frontend never handles credentials directly beyond form submission: `better-auth/react`'s `createAuthClient` (`frontend/src/lib/auth-client.ts`) talks to `/api/auth/*` and manages the browser's session state; the rest of the app (`apiClient`, Socket.IO) relies on the resulting cookie being sent automatically (`withCredentials: true`).

Only email/password authentication is implemented — confirmed both by `lib/auth.ts` (`emailAndPassword: { enabled: true, ... }`, no `socialProviders` configuration) and by the frontend, whose `features/auth/` directory contains only `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, and `reset-password-form.tsx` — no OAuth buttons or callback routes exist.

## Authentication flows

All of the following are live, Better Auth-provided `/api/auth/*` endpoints, wired to real frontend forms:

- **Sign up** (`POST /sign-up/email`) — creates a `User` row, unverified by default (except in local development, see below).
- **Sign in** (`POST /sign-in/email`) — issues a session cookie.
- **Sign out** — revokes the session (triggers the realtime eviction hook, see below).
- **Session retrieval** (`GET /get-session`) — what `useAuth()`/`AuthenticatedRoute` poll to determine auth state.
- **Email verification** (`POST /send-verification-email`, `GET /verify-email`) — required before sign-in succeeds in production.
- **Password reset** (`POST /request-password-reset`, `POST /reset-password`) — enabled by the presence of the `sendResetPassword` callback in `lib/auth.ts`; resetting a password revokes all of that user's existing sessions (`revokeSessionsOnPasswordReset: true`).

There is no username-based login, no magic link, and no multi-factor authentication configured.

## Session behavior

- **Lifetime**: 7 days (`SESSION_EXPIRES_IN_SECONDS`), with a rolling refresh once a session is more than 1 day old (`SESSION_UPDATE_AGE_SECONDS`) — both explicit values in `lib/auth.ts`, not implicit library defaults.
- **Cookies**: marked `Secure` based on `isProduction` specifically (not inferred from the configured base URL), so a misconfigured production deployment can't silently ship an insecure cookie.
- **Backend check**: `requireAuth` (`middleware/require-auth.ts`) calls `auth.api.getSession({ headers })` on every protected `/api/v1` route and attaches `req.user = { id, email, name }`.
- **Frontend check**: `useAuth()` (`features/auth/hooks/use-auth.ts`) wraps Better Auth's own session query; `AuthenticatedRoute` renders a loader while `status === "pending"`, a retryable error state on failure, and redirects to `/login` when unauthenticated — it does not flash protected content while the check is in flight.

## Email verification

- **Production/default behavior**: `requireEmailVerification: true` — an unverified account cannot sign in.
- **Local-development bypass**: a `databaseHooks.user.create.before` hook (`lib/auth.ts`) sets `emailVerified: true` at the moment a user row is inserted, but **only** when `isLocalDevelopment` is true — which requires `NODE_ENV` to be exactly `"development"` (not `"test"`, not unset). This exists so a freshly cloned repo can be signed up and used without a working Resend account. It cannot activate in production (`isLocalDevelopment` and `isProduction` can never both be true) and does not affect the test suite, which exercises the real, non-bypassed flow (`backend/tests/security/email-verification.test.ts`).

## Authorization boundary

Authentication only establishes **identity** — a valid session tells the backend *who* is making a request, nothing about *what* they're allowed to do. Every workspace-scoped action separately checks membership and role via `requireWorkspaceMembership`/`requireRole` (`shared/authorization/workspace-access.ts`) inside the relevant service function. See [`workspaces.md`](./workspaces.md) for that authorization model, and [`../architecture/system-design.md`](../architecture/system-design.md#6-authorization-and-rbac) for the architectural framing.

## Avatar protection

Better Auth's generic `POST /api/auth/update-user` and `POST /api/auth/sign-up/email` endpoints can otherwise write any field a client submits — including `User.image` — straight to the database. TeamOS blocks that specifically for `image`: a `hooks.before` check in `lib/auth.ts` rejects any request to either path that includes an `image` field at all. Avatar changes must instead go through the dedicated endpoints in the `user` module (`POST/GET/DELETE /api/v1/users/me/avatar`), which always compute the storage key themselves from the authenticated user's own id (`users/<userId>/avatar/...`) rather than accepting one from the request. This is what keeps a user's avatar storage key from ever becoming something a client can set directly on an arbitrary account.

## Demo accounts

A public demo session (`POST /api/v1/demo/session`) creates a real Better Auth user like any other sign-up, just automated and pre-verified, plus two additional fields — `isDemo` and `demoExpiresAt` — exposed read-only on the session/user object (`input: false`, so a client can read but never set them). Demo accounts authenticate exactly like real accounts; the only behavioral difference enforced elsewhere is that they cannot send workspace invitations. Full provisioning/cleanup detail is in [`demo.md`](./demo.md).

## Realtime / session revocation

Socket.IO authenticates a connection the same way HTTP does — `authenticateSocket` calls `auth.api.getSession(...)` against the handshake's cookie header. Beyond the initial handshake, session state and socket state are kept in sync in both directions:
- **Revocation**: a `databaseHooks.session.delete.after` hook (fires on sign-out, password reset, or any explicit session revocation) emits `session.revoked` to the affected user's live sockets and disconnects them — not just a room leave.
- **Rolling refresh**: a `databaseHooks.session.update.after` hook reschedules a connected socket's own expiry timer whenever Better Auth extends that session, so an active socket isn't disconnected at a now-stale deadline.

Full mechanism (including the handshake-vs-revocation race the code closes) is documented in [`../architecture/system-design.md` §10](../architecture/system-design.md#10-realtime-architecture).

## Security considerations

Controls actually present, not a generic checklist:
- Redis-backed rate limits on sign-in (20/min/IP, plus a separate HMAC-keyed 5-per-15-min-per-account limiter an IP-rotating attacker can't evade) and sign-up (10/min/IP).
- `revokeSessionsOnPasswordReset: true` — a password reset ends any session an attacker may already hold on that account.
- The avatar-write closure described above.
- Session cookies are `Secure` in production and never exposed to client-side JavaScript beyond what Better Auth's own client library reads through its normal session mechanism.
