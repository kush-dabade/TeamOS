import { createHmac } from "node:crypto";

import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "./prisma.js";
import { incrementRateLimitCounter, rateLimitRedis } from "./redis.js";
import { trustedOrigins } from "../config/security.config.js";
import { enqueueVerificationEmail } from "../queues/email/email.queue.js";

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

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  trustedOrigins,

  emailAndPassword: {
    enabled: true,
    // Without this, anyone can sign up with an email address they don't
    // own and be signed in immediately - assertInvitationEligible
    // (invitation.service.ts) only compares against the *session's*
    // email, so an unverified account could accept a workspace invitation
    // meant for the real owner of that address.
    requireEmailVerification: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Enqueued rather than sent inline: keeps sign-up latency
      // independent of Resend's availability and gets BullMQ's existing
      // retry/backoff, matching how workspace invitation email is
      // already sent (see queues/email/email.queue.ts).
      await enqueueVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      });
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
              console.error(
                "Sign-in account rate limit check failed, failing open:",
                error instanceof Error ? error.message : error,
              );

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
        console.error(
          "Sign-in account rate limit reset failed:",
          error instanceof Error ? error.message : error,
        );
      });
    }),
  },
});
