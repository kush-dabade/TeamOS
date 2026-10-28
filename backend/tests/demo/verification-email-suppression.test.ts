import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { auth } from "../../src/lib/auth.js";
import {
  isInDemoProvisioningContext,
  runInDemoProvisioningContext,
} from "../../src/lib/demo-provisioning-context.js";
import { prisma } from "../../src/lib/prisma.js";
import * as demoDataGenerator from "../../src/modules/demo/demo-data-generator.js";
import { createInvitation } from "../../src/modules/invitation/invitation.service.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { storageConfig } from "../../src/storage/index.js";

import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";
import { resetDatabase } from "../setup/reset-database.js";

/**
 * Public demo provisioning must not enqueue verification email for the
 * synthetic accounts it creates (the /try owner and its five teammates) -
 * Better Auth calls sendVerificationEmail from inside signUpEmail, before
 * provisioning marks those accounts verified, so before this fix every /try
 * session queued six undeliverable verification jobs. The suppression is a
 * server-only AsyncLocalStorage context (lib/demo-provisioning-context.ts)
 * read only by lib/auth.ts's sendVerificationEmail callback.
 *
 * The other half matters just as much: ordinary sign-ups - including ones
 * running concurrently with provisioning, and ones using a demo-lookalike
 * address - must still get their verification email and still be unable to
 * sign in until verified; and password-reset/invitation email must be
 * untouched even while the context is active.
 *
 * Runs under NODE_ENV=test, where (unlike local development) the
 * verification callback really enqueues - see config/security.config.ts's
 * isLocalDevelopment.
 */
describe("demo provisioning verification-email suppression", () => {
  // Every state a job can sit in with no worker running - wider than the
  // lookup states below so cleanup also catches anything unexpected.
  const ALL_JOB_STATES = [
    "waiting",
    "delayed",
    "active",
    "completed",
    "failed",
    "paused",
    "prioritized",
  ] as const;

  // Snapshot of what already existed before each test, so cleanup below
  // only ever touches what that test itself created - never another test
  // file's leftovers or local-development data that shares this storage
  // root and Redis instance.
  let preexistingUserEmails = new Set<string>();
  let preexistingWorkspaceIds = new Set<string>();

  // Recipients that never become a User row (e.g. an invitee), registered by
  // the test that uses them so their jobs are cleaned up too.
  const extraRecipients = new Set<string>();

  beforeEach(async () => {
    const [users, workspaces] = await Promise.all([
      prisma.user.findMany({ select: { email: true } }),
      prisma.workspace.findMany({ select: { id: true } }),
    ]);

    preexistingUserEmails = new Set(users.map((user) => user.email));
    preexistingWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    extraRecipients.clear();
  });

  // Runs whether the test passed or failed. Order matters: everything here
  // reads the database to work out what this test created, so
  // resetDatabase() must come last.
  afterEach(async () => {
    vi.restoreAllMocks();

    const [users, workspaces] = await Promise.all([
      prisma.user.findMany({ select: { email: true } }),
      prisma.workspace.findMany({ select: { id: true } }),
    ]);

    // Email jobs addressed to anyone this test created. The queue is shared
    // across test files (and no worker runs in tests, so nothing else ever
    // removes them), hence per-recipient removal rather than a wholesale
    // drain/obliterate.
    const recipients = new Set(extraRecipients);

    for (const user of users) {
      if (!preexistingUserEmails.has(user.email)) {
        recipients.add(user.email);
      }
    }

    const jobs = await emailQueue.getJobs([...ALL_JOB_STATES]);

    await Promise.all(
      jobs
        .filter((job) => recipients.has((job.data as { email?: string })?.email ?? ""))
        .map((job) => job.remove()),
    );

    // Attachment files demo provisioning seeded, under the same storage
    // root and workspaces/{workspaceId}/ layout attachment.service.ts uses -
    // scoped to this test's workspaces rather than the attachment suites'
    // whole-`workspaces` removal, since the default storage root is shared
    // with local development.
    await Promise.all(
      workspaces
        .filter((workspace) => !preexistingWorkspaceIds.has(workspace.id))
        .map((workspace) =>
          fs.rm(path.resolve(storageConfig.rootDirectory, "workspaces", workspace.id), {
            recursive: true,
            force: true,
          }),
        ),
    );

    await resetDatabase();
  });

  // No worker runs in the test suite, so queued jobs stay queued - and the
  // queue is shared across test files, so every lookup is filtered by the
  // (always unique) recipient address.
  async function jobsFor(name: string, email: string) {
    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);

    return jobs.filter((job) => job.name === name && job.data?.email === email);
  }

  function signUp(email: string) {
    return request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Ordinary User", email, password: "Password1234" })
      .expect(200);
  }

  async function demoUsers() {
    return prisma.user.findMany({ where: { isDemo: true } });
  }

  it("provisions the demo owner and teammates without queueing any verification email for them", async () => {
    await request(app).post("/api/v1/demo/session").expect(201);

    const users = await demoUsers();

    // The /try owner plus ensureEphemeralAcmeTeam's five teammates.
    expect(users).toHaveLength(6);

    for (const user of users) {
      expect(user.emailVerified).toBe(true);
      expect(await jobsFor(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, user.email)).toHaveLength(0);
    }
  });

  it("keeps the context out of sign-ups that run while provisioning is paused mid-flight, and inside provisioning across the pause", async () => {
    // Deterministic interleaving: pause provisioning after the owner's
    // signUpEmail (already inside the context) but before any teammate is
    // created, run complete ordinary/lookalike sign-ups during the pause,
    // then resume. Teammate creation therefore happens strictly AFTER the
    // ordinary requests - proving the context neither leaked into them nor
    // was lost by provisioning across the gap.
    let reachedPause = false;
    let markPaused!: () => void;
    const paused = new Promise<void>((resolve) => {
      markPaused = () => {
        reachedPause = true;
        resolve();
      };
    });

    let resume!: () => void;
    const resumed = new Promise<void>((resolve) => {
      resume = resolve;
    });

    const realGenerateWorkspaceData = demoDataGenerator.generateWorkspaceData;

    vi.spyOn(demoDataGenerator, "generateWorkspaceData").mockImplementation(
      async (workspaceId, ownerId) => {
        markPaused();
        await resumed;

        return realGenerateWorkspaceData(workspaceId, ownerId);
      },
    );

    // supertest only sends on .then() - start it now, await it later.
    const demoResponse = request(app)
      .post("/api/v1/demo/session")
      .then((res) => res);

    const ordinaryEmails = [1, 2, 3].map(
      (n) => `concurrent-${n}-${crypto.randomUUID()}@example.com`,
    );
    // A demo-teammate-shaped address: suppression must not key on the
    // domain or address shape, so this still gets a verification email.
    const lookalikeEmail = `maya.chen+${crypto.randomUUID().slice(0, 8)}@acme.local`;

    try {
      // If provisioning fails before reaching the pause, fail fast here
      // instead of waiting on `paused` until the test times out (a timed-out
      // test never reaches the finally below). Only throws when the pause
      // was never reached, so the losing side of the race can't surface as
      // an unhandled rejection once provisioning later completes normally.
      await Promise.race([
        paused,
        demoResponse.then(
          (res) => {
            if (!reachedPause) {
              throw new Error(`Demo provisioning finished before pausing (status ${res.status})`);
            }
          },
          (error: unknown) => {
            if (!reachedPause) {
              throw error;
            }
          },
        ),
      ]);

      await Promise.all([...ordinaryEmails, lookalikeEmail].map((email) => signUp(email)));
    } finally {
      // Always let provisioning finish - and wait for it - before afterEach
      // resets the database; otherwise a failed assertion above would leave
      // it paused, or resume it to write into a freshly reset database.
      resume();
      await demoResponse.catch(() => undefined);
    }

    expect((await demoResponse).status).toBe(201);

    for (const email of [...ordinaryEmails, lookalikeEmail]) {
      expect(await jobsFor(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, email)).toHaveLength(1);
    }

    const users = await demoUsers();

    expect(users).toHaveLength(6);

    for (const user of users) {
      expect(await jobsFor(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, user.email)).toHaveLength(0);
    }

    // And a sign-up after provisioning has finished is unaffected too.
    const afterEmail = `after-${crypto.randomUUID()}@example.com`;

    await signUp(afterEmail);

    expect(await jobsFor(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, afterEmail)).toHaveLength(1);
  });

  it("does not let a demo-lookalike address skip verification", async () => {
    const email = `daniel.brooks+${crypto.randomUUID().slice(0, 8)}@acme.local`;
    const password = "Password1234";

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Lookalike", email, password })
      .expect(200);

    expect(await jobsFor(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, email)).toHaveLength(1);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(user.emailVerified).toBe(false);
    expect(user.isDemo).toBe(false);

    const signIn = await request(app).post("/api/auth/sign-in/email").send({ email, password });

    expect(signIn.status).toBe(403);
    expect(signIn.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(signIn.headers["set-cookie"]).toBeUndefined();
  });

  it("still enqueues password-reset and invitation email while the context is active", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const inviteeEmail = `invitee-${crypto.randomUUID()}@example.com`;

    extraRecipients.add(inviteeEmail);

    await runInDemoProvisioningContext(async () => {
      expect(isInDemoProvisioningContext()).toBe(true);

      await auth.api.requestPasswordReset({ body: { email: owner.email } });
      await createInvitation({
        workspaceId: workspace.id,
        email: inviteeEmail,
        role: "MEMBER",
        invitedById: owner.userId,
      });
    });

    expect(await jobsFor(EMAIL_JOB_NAMES.PASSWORD_RESET, owner.email)).toHaveLength(1);
    expect(await jobsFor(EMAIL_JOB_NAMES.WORKSPACE_INVITATION, inviteeEmail)).toHaveLength(1);
  });

  it("is only active inside runInDemoProvisioningContext", async () => {
    expect(isInDemoProvisioningContext()).toBe(false);

    const inside = await runInDemoProvisioningContext(async () => {
      await Promise.resolve();

      return isInDemoProvisioningContext();
    });

    expect(inside).toBe(true);
    expect(isInDemoProvisioningContext()).toBe(false);
  });
});
