import { createHmac } from "node:crypto";

import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import { incrementRateLimitCounter, rateLimitRedis } from "./redis.js";
import { isProduction, trustedOrigins } from "../config/security.config.js";
import {
  enqueuePasswordResetEmail,
  enqueueVerificationEmail,
} from "../queues/email/email.queue.js";

// Mirrors the same fail-fast check already in app.ts and
// modules/email/email.config.ts (each process-local consumer of
// FRONTEND_URL validates it independently) - this file now actually reads
// the value, to build the default email-verification callback URL below.
const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL environment variable is required.");
}

// Reused as the HMAC key for signInAccountRateLimitKey below rather than
// introducing a second secret - this is already Better Auth's own signing
// secret (read implicitly via this exact env var whenever `secret` isn't
// passed to betterAuth({...}) below), already required in every
// environment this app runs in (see backend/.env.example, backend/.env.test,
// and docker-compose.yml's env_file: backend/.env), so it needs no new
// configuration surface, deployment step, or test-environment setup.
// Typed/coerced to a plain string (rather than left as `string | undefined`)
// so every later usage - including inside createHmac, which requires a real
// BinaryLike, not undefined - doesn't need its own narrowing or assertion.
// The guard below still throws on a genuinely missing/empty value; this
// only changes the static type the rest of the file sees.
const authHmacSecret: string = process.env.BETTER_AUTH_SECRET ?? "";

if (!authHmacSecret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required.");
}

// F-14: bounds how long sendVerificationEmail/sendResetPassword below wait
// on their respective enqueue calls. Verified against the installed bullmq
// (node_modules/bullmq/dist/cjs/classes/redis-connection.js): BullMQ forces
// maxRetriesPerRequest: null on any connection it builds from a plain options
// object for a blocking-capable client (which emailQueue's connection is,
// since email.worker.ts's Worker shares config/redis.config.ts's
// redisConfig - both enqueueVerificationEmail and enqueuePasswordResetEmail
// call .add() on that exact same Queue instance) - so a genuinely
// unreachable Redis doesn't make .add() fail fast, it makes ioredis buffer
// the command and retry the connection forever. Confirmed empirically for
// both: emailQueue.add() and the real enqueuePasswordResetEmail() function
// itself, each run against an unreachable host, never settled in an 8+
// second test run. 2s comfortably covers normal Redis latency/jitter while
// keeping these requests responsive even during a real outage.
const ENQUEUE_EMAIL_TIMEOUT_MS = 2000;

// Shared by sendVerificationEmail and sendResetPassword below - both are
// Better Auth callbacks on a request's critical path (see
// runInBackgroundOrAwait's doc in sendVerificationEmail), both enqueue onto
// the same emailQueue, and both need the identical bounded-wait/fail-open
// treatment, so this is the one place that logic lives rather than
// duplicating the same Promise.race+catch block twice. Racing (not
// aborting) means a timed-out enqueue attempt isn't cancelled - it can
// still succeed on its own once Redis recovers, so no email attempt is
// silently discarded, only the caller's wait on it is bounded.
async function enqueueEmailWithTimeout(label: string, enqueue: Promise<void>): Promise<void> {
  await Promise.race([
    enqueue,
    new Promise((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Timed out enqueueing ${label}`)),
        ENQUEUE_EMAIL_TIMEOUT_MS,
      );
    }),
  ]).catch((error: unknown) => {
    // Fail-open/degraded, not a genuine failure - the enqueue may still
    // succeed on its own once Redis recovers (see this function's own doc
    // comment above); only the caller's bounded wait on it timed out.
    logger.warn({ err: error }, `Failed to enqueue ${label} in time; request proceeds regardless`);
  });
}

// Account-scoped half of sign-in brute-force protection. The IP-scoped
// half (signInIpLimiter in middleware/rate-limit.ts) can't stop an
// attacker who rotates source IPs against one target account - this
// closes that gap by keying on the normalized identity being attacked
// instead. Tighter than the IP limiter (5 vs 20) and a much longer window
// (15 min vs 1 min), since this is the actual anti-credential-guessing
// bound; the IP limiter's job is only to cap raw request volume/scanning.
const SIGN_IN_ACCOUNT_LIMIT = 5;
const SIGN_IN_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

// Same identity-matching convention already used everywhere else email
// identity is compared in this codebase (see e.g.
// modules/invitation/invitation.schema.ts's z.string().trim().toLowerCase()
// and invitation.service.ts's email.toLowerCase() calls) - kept consistent
// here rather than inventing a separate normalization rule.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// HMAC-SHA256 of the normalized email, not the email itself - Redis keys
// are visible through backups, SCAN, admin/monitoring tooling, etc. in a
// way that shouldn't casually expose a user's raw address. Keying on the
// HMAC digest instead of a reversible encoding (e.g. base64) keeps the
// bucket lookup deterministic (same email always produces the same
// digest, so repeated attempts still share one bucket) while making the
// key itself non-reversible without authHmacSecret. digest("hex") is
// always a fixed 64 characters for sha256, regardless of input length.
function signInAccountRateLimitKey(normalizedEmail: string): string {
  const digest = createHmac("sha256", authHmacSecret).update(normalizedEmail).digest("hex");

  return `rl:auth:signin:account:${digest}`;
}

// P2-COOKIE: previously left implicit (Better Auth's own defaults). Values
// below are unchanged from what those defaults already were - this is a
// deliberate-vs-implicit change, not a behavior change. Verified against the
// installed better-auth (dist/context/create-context.mjs): `expiresIn`
// defaults to 3600 * 24 * 7 and `updateAge` to 1440 * 60 whenever
// `session.expiresIn`/`session.updateAge` are left unset.
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  trustedOrigins,

  session: {
    // How long a session is valid for before it requires a fresh sign-in,
    // and how old a session must be before a request against it pushes its
    // expiry back out (a rolling window, not a fixed one) - both already
    // Better Auth's own defaults, now recorded here as an explicit,
    // reviewed decision rather than an implicit library default.
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  advanced: {
    // Without this, Better Auth infers the cookie's Secure attribute from
    // whether BETTER_AUTH_URL happens to start with "https://" (see the
    // installed better-auth's dist/cookies/index.mjs) - NOT from NODE_ENV.
    // That means a production deploy with a misconfigured BETTER_AUTH_URL
    // (e.g. left as an http:// value) would silently ship a session cookie
    // without the Secure attribute despite NODE_ENV=production, with no
    // warning. Tying this directly to isProduction instead - the same
    // signal middleware/security-headers.ts already gates HSTS on - removes
    // that footgun. This is the one deliberate behavior change in this
    // commit: identical in every environment this app currently runs in
    // (dev/test/CI all resolve isProduction to false either way), but no
    // longer silently dependent on BETTER_AUTH_URL's exact string value in
    // production.
    useSecureCookies: isProduction,
  },

  emailAndPassword: {
    enabled: true,
    // Without this, anyone can sign up with an email address they don't
    // own and be signed in immediately - assertInvitationEligible
    // (invitation.service.ts) only compares against the *session's*
    // email, so an unverified account could accept a workspace invitation
    // meant for the real owner of that address.
    requireEmailVerification: true,

    // Presence of this callback alone is what turns on
    // POST /request-password-reset and POST /reset-password (see
    // requestPasswordReset in the installed better-auth package's
    // api/routes/password.ts - it 400s with RESET_PASSWORD_DISABLED
    // without one). Token generation, its persistence in the existing
    // `verification` table, expiration, and single-use consumption are
    // all handled internally by Better Auth - this only wires the already-
    // generated link into TeamOS's own email delivery, the same way
    // emailVerification.sendVerificationEmail below does.
    sendResetPassword: async ({ user, url }) => {
      // Enqueued rather than sent inline, same rationale as
      // sendVerificationEmail below: keeps this request's latency
      // independent of Resend's availability and gets BullMQ's existing
      // retry/backoff. `url` is Better Auth's own
      // `${baseURL}/reset-password/:token?callbackURL=...` link - never
      // logged here or anywhere downstream (email.worker.ts only logs the
      // job id/name on success or failure, never job.data).
      //
      // F-14 follow-up: this callback runs on POST /request-password-reset's
      // request path via the identical runInBackgroundOrAwait mechanism
      // documented on sendVerificationEmail below (verified against the
      // installed better-auth's api/routes/password.mjs: same
      // `await ctx.context.runInBackgroundOrAwait(...)` shape, same shared
      // implementation) - bounded the same way, for the same reason.
      await enqueueEmailWithTimeout(
        "password-reset email",
        enqueuePasswordResetEmail({
          email: user.email,
          name: user.name,
          url,
        }),
      );
    },

    // A password reset is exactly the scenario where an attacker may
    // already hold a live session on the account being recovered (that's
    // often *why* the legitimate owner is resetting it) - without this,
    // resetting the password does nothing to end that session.
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Enqueued rather than sent inline: keeps sign-up latency
      // independent of Resend's availability and gets BullMQ's existing
      // retry/backoff, matching how workspace invitation email is
      // already sent (see queues/email/email.queue.ts).
      //
      // F-14: this callback runs on POST /sign-up/email's request path -
      // the installed better-auth (node_modules/better-auth/dist/context/
      // create-context.mjs's runInBackgroundOrAwait) awaits it directly
      // unless an advanced.backgroundTasks.handler is configured (it isn't
      // here), and already catches whatever this eventually rejects with,
      // so a slow/failed enqueue was never going to fail sign-up itself -
      // but with no bound on the wait, a genuinely unreachable Redis (see
      // ENQUEUE_EMAIL_TIMEOUT_MS's comment above) means this callback's
      // promise never settles, and neither does the sign-up response, even
      // though the account was already created. enqueueEmailWithTimeout
      // (same fail-open philosophy as incrementRateLimitCounter's .catch()
      // in the `before` hook below) is what actually keeps sign-up
      // responsive. A user left without a verification email after a
      // timeout can always request a fresh one via
      // POST /send-verification-email.
      await enqueueEmailWithTimeout(
        "verification email",
        enqueueVerificationEmail({
          email: user.email,
          name: user.name,
          url,
        }),
      );
    },
  },

  // F-07: fires after Better Auth deletes a session row - verified against
  // the installed better-auth (db/with-hooks.mjs's deleteWithHooks): every
  // explicit revocation path (POST /sign-out, /revoke-session,
  // /revoke-sessions & revokeOtherSessions, and revokeSessionsOnPasswordReset
  // above) funnels through internalAdapter.deleteSession -> deleteWithHooks,
  // which fetches the full row before deleting it and calls this hook with
  // that row - so session.userId/session.id are always populated here,
  // covering every one of those paths from this single hook rather than
  // matching on ctx.path the way the sign-in rate limiter below has to.
  //
  // realtime.eviction.js is imported dynamically, not statically, to avoid a
  // real circular import: realtime.auth.ts already imports `auth` from this
  // file, and realtime.eviction.ts transitively imports realtime.server.ts
  // -> realtime.auth.ts. A static import here would close that cycle
  // (lib/auth.ts -> realtime.eviction.ts -> realtime.server.ts ->
  // realtime.auth.ts -> lib/auth.ts); deferring resolution until the hook
  // actually runs (well after both modules have finished initializing)
  // avoids relying on that cycle happening to be safe.
  databaseHooks: {
    session: {
      delete: {
        after: async (session) => {
          // Must never throw: this hook runs via
          // @better-auth/core's queueAfterTransactionHook, whose pending
          // hooks are awaited outside the try/catch that guards the
          // triggering call's own errors (verified against the installed
          // @better-auth/core's context/transaction.mjs) - an uncaught
          // rejection here would propagate out of deleteSession() and fail
          // the sign-out/revoke-session/revoke-sessions/password-reset
          // request itself, not just this best-effort cleanup. Mirrors the
          // same try/catch + "SECURITY:"-prefixed logger.error convention
          // workspace.service.ts already uses around evictFromWorkspace.
          try {
            const { evictUserSession } = await import("../realtime/realtime.eviction.js");

            await evictUserSession(session.userId, session.id);
          } catch (error) {
            logger.error(
              { err: error, userId: session.userId, sessionId: session.id },
              "SECURITY: failed to evict revoked session's sockets - they may " +
                "continue receiving realtime events until their socket disconnects " +
                "or reconnects on its own",
            );
          }
        },
      },
    },
  },

  hooks: {
    // Better Auth builds the verification link from the request's own
    // callbackURL, defaulting to this API server's own root ("/") when
    // none is supplied - the frontend doesn't send one, so without this
    // the emailed link redirects back to the backend instead of the app.
    // Defaulting it here (rather than requiring every caller of sign-up
    // or resend-verification to pass it) is Better Auth's own supported
    // mechanism for this: https://www.better-auth.com/docs/concepts/hooks
    before: createAuthMiddleware(async (ctx) => {
      // Runs before Better Auth even attempts to verify the password -
      // deliberately incrementing first and comparing after (the same
      // "increment first, then compare" order the Express-level limiters
      // in middleware/rate-limit.ts get for free from rate-limit-redis),
      // not a read-then-act check. That's what makes this genuinely
      // concurrency-safe: two simultaneous requests against the same
      // account each get a unique, atomically-assigned count, so neither
      // can slip through believing it's "still under the limit" based on
      // a stale read. A successful sign-in has its consumed slot refunded
      // afterward (see the `after` hook below), so this only ever
      // accumulates real failed/blocked attempts, never a legitimate
      // user's eventual correct password entry.
      if (ctx.path === "/sign-in/email") {
        const rawEmail = ctx.body?.email;

        if (typeof rawEmail === "string" && rawEmail.length > 0) {
          const key = signInAccountRateLimitKey(normalizeEmail(rawEmail));
          const count = await incrementRateLimitCounter(key, SIGN_IN_ACCOUNT_WINDOW_MS).catch(
            (error: unknown) => {
              // Fails open, matching FAIL_OPEN_ON_STORE_ERROR's philosophy
              // in middleware/rate-limit.ts: a Redis outage degrades this
              // to "temporarily unprotected," not "nobody can sign in."
              logger.warn({ err: error }, "Sign-in account rate limit check failed, failing open");

              return null;
            },
          );

          if (count !== null && count > SIGN_IN_ACCOUNT_LIMIT) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: "RATE_LIMITED",
              message: "Too many sign-in attempts for this account. Please try again later.",
            });
          }
        }

        return;
      }

      if (
        (ctx.path === "/sign-up/email" || ctx.path === "/send-verification-email") &&
        !ctx.body?.callbackURL
      ) {
        return {
          context: {
            ...ctx,
            body: {
              ...ctx.body,
              callbackURL: `${frontendUrl}/verify-email`,
            },
          },
        };
      }

      // Same reasoning as the callbackURL default above, applied to
      // request-password-reset's differently-named `redirectTo` field
      // (Better Auth's own requestPasswordReset endpoint uses that name,
      // not callbackURL). Without it, Better Auth builds the emailed link
      // with an empty callbackURL, and its GET /reset-password/:token
      // redirect step (see requestPasswordResetCallback in the installed
      // package) then has nowhere to send the user - the reset would land
      // back on this API server instead of the frontend's /reset-password
      // page Commit 6 adds.
      if (ctx.path === "/request-password-reset" && !ctx.body?.redirectTo) {
        return {
          context: {
            ...ctx,
            body: {
              ...ctx.body,
              redirectTo: `${frontendUrl}/reset-password`,
            },
          },
        };
      }
    }),

    // Refunds the slot the `before` hook above consumed for this request,
    // once it's known to have been a successful sign-in rather than a
    // failed/blocked one. ctx.context.returned is only populated once the
    // real endpoint handler has actually run (Better Auth's own
    // to-auth-endpoints.mjs assigns it immediately before invoking after
    // hooks) and is an APIError instance specifically when the handler
    // rejected the attempt - wrong password, unverified email, this same
    // limiter's own TOO_MANY_REQUESTS throw, etc. Anything else means it
    // succeeded, so the account's recent-failures history is cleared:
    // a legitimate user who mistypes their password a few times and then
    // gets it right isn't left one step closer to being locked out.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" || ctx.context.returned instanceof APIError) {
        return;
      }

      const rawEmail = ctx.body?.email;

      if (typeof rawEmail !== "string" || rawEmail.length === 0) {
        return;
      }

      const key = signInAccountRateLimitKey(normalizeEmail(rawEmail));

      await rateLimitRedis.del(key).catch((error: unknown) => {
        // Same fail-open philosophy as the increment above - worst case
        // here is one fewer available attempt left in the current window
        // for a legitimate user, not a security issue, so this is safe to
        // swallow rather than fail the (already-successful) sign-in over.
        logger.warn({ err: error }, "Sign-in account rate limit reset failed");
      });
    }),
  },
});
