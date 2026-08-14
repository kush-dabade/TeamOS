import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "./prisma.js";
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
  },
});
