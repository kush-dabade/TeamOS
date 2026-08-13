import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "./prisma.js";
import { trustedOrigins } from "../config/security.config.js";
import { enqueueVerificationEmail } from "../queues/email/email.queue.js";

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
});
