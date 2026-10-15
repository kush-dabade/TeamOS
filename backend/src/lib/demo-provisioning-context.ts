import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Marks "this code is running inside public demo provisioning"
 * (modules/demo/demo.service.ts's provisionDemoSession) for exactly one
 * consumer: lib/auth.ts's emailVerification.sendVerificationEmail callback,
 * which skips enqueueing a verification email while this is set.
 *
 * Why a request-scoped context rather than anything on the user record:
 * Better Auth invokes sendVerificationEmail from INSIDE auth.api.signUpEmail
 * (verified against the installed better-auth's api/routes/sign-up.mjs),
 * before that call returns - so before demo.service.ts / the demo data
 * generator can mark the new row emailVerified/isDemo. And isDemo can't be
 * set during sign-up at all: it is `input: false` (lib/auth.ts), which
 * Better Auth enforces for server-side auth.api calls too, replacing any
 * supplied value with the default. Without this, every /try session queued
 * one undeliverable verification email per synthetic account (the owner
 * plus five teammates), each retried by BullMQ.
 *
 * Why this can't be used to bypass verification: the only way to set it is
 * calling runInDemoProvisioningContext() from server code - no request
 * header, body field, cookie, or email address can reach it. And it only
 * suppresses SENDING; it never marks anyone verified. Demo accounts are
 * verified by demo provisioning's own explicit Prisma writes, exactly as
 * before.
 *
 * AsyncLocalStorage scopes the flag to one async call chain: it propagates
 * through every await (including Better Auth's own callback invocation and
 * the demo generator's Promise.all teammate creation) but never into
 * unrelated concurrent requests - see
 * tests/demo/verification-email-suppression.test.ts.
 */
const demoProvisioningContext = new AsyncLocalStorage<true>();

export function runInDemoProvisioningContext<T>(fn: () => Promise<T>): Promise<T> {
  return demoProvisioningContext.run(true, fn);
}

export function isInDemoProvisioningContext(): boolean {
  return demoProvisioningContext.getStore() === true;
}
