import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { DEMO_WORKSPACE_NAME } from "../../src/modules/demo/demo.constants.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { notificationQueue } from "../../src/queues/notification/notification.queue.js";
import { storageConfig } from "../../src/storage/index.js";

import { resetDatabase } from "../setup/reset-database.js";

/**
 * Two /try visitors arriving at the same moment. Every demo workspace is
 * named "Acme Inc.", so this is exactly the case createWorkspace's slug
 * allocation used to lose: both requests saw the same slug as free, and the
 * second failed the Workspace.slug unique index (409, leaving an orphaned
 * demo user for the TTL sweep). The per-slug-root advisory lock in
 * workspace.service.ts serializes the two allocations instead.
 */
describe("concurrent public demo provisioning", () => {
  // Every state a job can sit in with no worker running.
  const ALL_JOB_STATES = [
    "waiting",
    "delayed",
    "active",
    "completed",
    "failed",
    "paused",
    "prioritized",
  ] as const;

  // Snapshot of what existed before the test, so cleanup only ever touches
  // what the test itself created - the storage root and Redis are shared
  // with other test files and with local development.
  let preexistingWorkspaceIds = new Set<string>();
  let preexistingUserEmails = new Set<string>();

  beforeEach(async () => {
    const [workspaces, users] = await Promise.all([
      prisma.workspace.findMany({ select: { id: true } }),
      prisma.user.findMany({ select: { email: true } }),
    ]);

    preexistingWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    preexistingUserEmails = new Set(users.map((user) => user.email));
  });

  // Runs whether the test passed or failed; reads the database to find what
  // the test created, so resetDatabase() comes last.
  afterEach(async () => {
    const [workspaces, users] = await Promise.all([
      prisma.workspace.findMany({ select: { id: true } }),
      prisma.user.findMany({ select: { email: true } }),
    ]);

    const createdWorkspaceIds = new Set(
      workspaces.map((workspace) => workspace.id).filter((id) => !preexistingWorkspaceIds.has(id)),
    );
    const createdUserEmails = new Set(
      users.map((user) => user.email).filter((email) => !preexistingUserEmails.has(email)),
    );

    // Seeded task assignments/comments enqueue notification jobs (keyed by
    // workspace); email jobs are matched by recipient in case provisioning
    // ever enqueues any again. Per-job removal, never a wholesale drain.
    const [notificationJobs, emailJobs] = await Promise.all([
      notificationQueue.getJobs([...ALL_JOB_STATES]),
      emailQueue.getJobs([...ALL_JOB_STATES]),
    ]);

    await Promise.all([
      ...notificationJobs
        .filter((job) =>
          createdWorkspaceIds.has((job.data as { workspaceId?: string })?.workspaceId ?? ""),
        )
        .map((job) => job.remove()),
      ...emailJobs
        .filter((job) => createdUserEmails.has((job.data as { email?: string })?.email ?? ""))
        .map((job) => job.remove()),
    ]);

    // Seeded attachment files, under attachment.service.ts's
    // workspaces/{workspaceId}/ layout - only this test's workspaces.
    await Promise.all(
      [...createdWorkspaceIds].map((workspaceId) =>
        fs.rm(path.resolve(storageConfig.rootDirectory, "workspaces", workspaceId), {
          recursive: true,
          force: true,
        }),
      ),
    );

    await resetDatabase();
  });

  it("provisions two simultaneous demo sessions, each with its own distinct Acme Inc. workspace slug", async () => {
    const [first, second] = await Promise.all([
      request(app).post("/api/v1/demo/session"),
      request(app).post("/api/v1/demo/session"),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const demoWorkspaces = await prisma.workspace.findMany({
      where: { name: DEMO_WORKSPACE_NAME, owner: { isDemo: true } },
    });

    expect(demoWorkspaces).toHaveLength(2);
    expect(new Set(demoWorkspaces.map((workspace) => workspace.slug)).size).toBe(2);

    // Two owners plus five teammates each - neither provisioning was cut
    // short.
    expect(await prisma.user.count({ where: { isDemo: true } })).toBe(12);
  });
});
