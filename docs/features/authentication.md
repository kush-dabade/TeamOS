# Authentication

## Overview

TeamOS authenticates users with **Better Auth** (`backend/src/lib/auth.ts`), using **session cookies** — there is no JWT, no Bearer token, and no OAuth provider configured. The frontend never handles credentials directly beyond form submission: `better-auth/react`'s `createAuthClient` (`frontend/src/lib/auth-client.ts`) talks to `/api/auth/*` and manages the browser's session state; the rest of the app (`apiClient`, Socket.IO) relies on the resulting cookie being sent automatically (`withCredentials: true`).

Only email/password authentication is implemented — confirmed both by `lib/auth.ts` (`emailAndPassword: { enabled: true, ... }`, no `socialProviders` configuration) and by the frontend, whose `features/auth/` directory contains only `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, and `reset-password-form.tsx` — no OAuth buttons or callback routes exist.

## Authentication flows

All of the following are live, Better Auth-provided `/api/auth/*` endpoints, wired to real frontend forms:

- **Sign up** (`POST /sign-up/email`) — creates a `User` row, unverified by default (except in local development, see below). It signs the user in only when mandatory verification is turned off.
- **Sign in** (`POST /sign-in/email`) — issues a session cookie.
- **Sign out** — revokes the session (triggers the realtime eviction hook, see below).
- **Session retrieval** (`GET /get-session`) — what `useAuth()`/`AuthenticatedRoute` poll to determine auth state.
- **Email verification** (`POST /send-verification-email`, `GET /verify-email`) — required before sign-in succeeds, unless `REQUIRE_EMAIL_VERIFICATION=false` (see below).
- **Password reset** (`POST /request-password-reset`, `POST /reset-password`) — enabled by the presence of the `sendResetPassword` callback in `lib/auth.ts`; resetting a password revokes all of that user's existing sessions (`revokeSessionsOnPasswordReset: true`).

There is no username-based login, no magic link, and no multi-factor authentication configured.

## Session behavior

- **Lifetime**: 7 days (`SESSION_EXPIRES_IN_SECONDS`), with a rolling refresh once a session is more than 1 day old (`SESSION_UPDATE_AGE_SECONDS`) — both explicit values in `lib/auth.ts`, not implicit library defaults.
- **Cookies**: marked `Secure` based on `isProduction` specifically (not inferred from the configured base URL), so a misconfigured production deployment can't silently ship an insecure cookie.
- **Backend check**: `requireAuth` (`middleware/require-auth.ts`) calls `auth.api.getSession({ headers })` on every protected `/api/v1` route and attaches `req.user = { id, email, name }`.
- **Frontend check**: `useAuth()` (`features/auth/hooks/use-auth.ts`) wraps Better Auth's own session query; `AuthenticatedRoute` renders a loader while `status === "pending"`, a retryable error state on failure, and redirects to `/login` when unauthenticated — it does not flash protected content while the check is in flight.

## Email verification

- **Default behavior**: `requireEmailVerification` is on — sign-up creates no session, an unverified account's sign-in fails with `403 EMAIL_NOT_VERIFIED`, and sign-up for an already-registered email returns the same generic success as a new one. The register page shows a "Check your email" confirmation.
- **`REQUIRE_EMAIL_VERIFICATION`** (`config/security.config.ts`, read by both the backend and the worker): unset or `"true"` keeps verification mandatory; `"false"` turns it off; any other value, including an empty one, stops startup. Read once at boot, so a change needs the containers recreated.
- **Local-development bypass**: a `databaseHooks.user.create.before` hook (`lib/auth.ts`) sets `emailVerified: true` at the moment a user row is inserted, but **only** when `isLocalDevelopment` is true — which requires `NODE_ENV` to be exactly `"development"` (not `"test"`, not unset). This exists so a freshly cloned repo can be signed up and used without a working Resend account. It cannot activate in production (`isLocalDevelopment` and `isProduction` can never both be true) and does not affect the test suite, which exercises the real, non-bypassed flow (`backend/tests/security/email-verification.test.ts`).

### When verification is turned off

Intended only for a deployment that can't yet deliver email to arbitrary recipients (see [deployment § Email](../development/deployment.md#email)). With `REQUIRE_EMAIL_VERIFICATION=false`:

- Sign-up signs the new user in immediately, and the register page continues like a successful login (back to an invitation link if one sent them there). Signing in later works without verifying.
- No verification email is queued on sign-up. Users can still verify voluntarily from their profile ("Resend verification email"), and that callback, the queue, the worker, invitation email, and password-reset email are all unchanged.
- Sign-up for an already-registered email returns `422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, so sign-up reveals which addresses have accounts. The sign-up IP rate limit still applies.
- Existing accounts and sessions are untouched; previously unverified accounts can now sign in.

**Security trade-off.** An email address no longer proves who owns an account: anyone can register an address they don't control, and the real owner then can't register it. Their way back is a password reset, which needs working email. Everything else is unchanged — session validation, RBAC, workspace membership checks, tenant isolation, rate limits, and the password policy.

**Invitation guard (always on).** The only place TeamOS authorizes on email is invitations. Listing your invitations (`GET /api/v1/invitations`) and accepting or declining one by id (`POST /api/v1/invitations/:id/accept|decline`) match on the session's email, so they return `403` for an unverified account, before any lookup (`assertEmailVerifiedForEmailMatch` in `invitation.service.ts`). The token routes (`/api/v1/invitations/token/:token/*`), which the frontend uses, stay open, because the token is only ever emailed to the invited address. They still require the session's email to match the invitation. With verification on, every signed-in account is verified, so the guard changes nothing.

**Invitation email while it's off.** An unverified account is a normal workspace owner, so it can send invitation email to any address, subject only to the per-account invitation rate limit. That's the abuse the demo-account rule in `createInvitation` blocks for `/try` accounts, and it isn't blocked here. It costs nothing while the sending domain is unverified, because Resend then delivers to no one but the account owner. Weigh it before enabling unrestricted email delivery with verification still off.

**Restoring verification.** Remove the variable (or set it to `"true"`) and recreate the backend and worker. From then on, every sign-up needs verification again and every sign-in by an unverified account fails with `EMAIL_NOT_VERIFIED`. No code or data changes are needed for that.

**Sessions issued while verification was off stay valid.** Better Auth checks `emailVerified` only when it creates a session (sign-in, sign-up), never when it reads one: `getSession`, which `requireAuth` and the Socket.IO handshake both use, accepts any unexpired session. Sessions also renew themselves while in use (`SESSION_UPDATE_AGE_SECONDS`), so an unverified user who keeps using the app is never asked to sign in again, and so never reaches the verification check. Changing the setting doesn't change that. Restoring verification alone means:

- New sign-ups and sign-ins require verification.
- Unverified users who are already signed in keep their access until their session lapses: 7 days without use, or signing out.
- The invitation guard above keeps refusing them the email-matched invitation operations either way.

To end that existing access, an operator has to invalidate those users' sessions deliberately. That's an operational step, separate from the sign-in flow: [deployment § Restoring verification](../development/deployment.md#restoring-verification). Once their sessions are gone, those users go through the normal flow: sign-in fails with `EMAIL_NOT_VERIFIED`, and the login screen offers "Resend verification email". Don't mark accounts verified in the database.

## Password and name rules

The rules the forms show are enforced on the server (`lib/password-policy.ts`, applied in `lib/auth.ts`'s `hooks.before`), so they hold for every client:

- **Passwords**: 8–128 characters, with at least one uppercase letter, one lowercase letter, and one number. They're checked on sign-up, reset-password, and change-password (`PASSWORD_POLICY_VIOLATION`). Sign-in isn't checked, so an existing password always keeps working.
- **Names**: 1–50 characters once trimmed, checked on sign-up and update-user (`INVALID_NAME`).

Demo accounts get random passwords from `generateRandomCompliantPassword`, so provisioning satisfies the same rules.

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
