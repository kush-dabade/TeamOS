import fs from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { storageConfig } from "../../src/storage/index.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  trackEvent,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

// Mirrors LocalStorageProvider's own resolveAbsolutePath (local.provider.ts):
// storageConfig.rootDirectory resolved against process.cwd(), then the
// storageKey resolved against that. Duplicated here (not imported) since
// resolveAbsolutePath is a private method on the provider class, not
// exported - this is the same computation done independently, to assert
// against the real filesystem rather than through the code under test.
function attachmentFilePath(storageKey: string): string {
  return path.resolve(path.resolve(storageConfig.rootDirectory), storageKey);
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Same technique as tests/activity/transactional-writes.test.ts's own
 * withActivityInsertFailure (not exported from that file, so reproduced
 * here rather than reaching across test files for shared infra): a
 * Postgres trigger, scoped to one (actorId, ActivityType) pair, that forces
 * the Activity INSERT to fail. A JS-level mock can't reach a write made
 * through the `tx` client prisma.$transaction hands to its callback (it's a
 * distinct object from the global `prisma` singleton), so interception has
 * to happen at the database level. Torn down in `finally` regardless of
 * outcome, so it can never leak into another test.
 */
async function withActivityInsertFailure(
  actorId: string,
  activityType: string,
  run: () => Promise<void>,
): Promise<void> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const functionName = `test_reject_activity_fn_${suffix}`;
  const triggerName = `test_reject_activity_trigger_${suffix}`;

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "${functionName}"() RETURNS trigger AS $$
    BEGIN
      IF NEW."actorId" = '${actorId}' AND NEW."type" = '${activityType}'::"ActivityType" THEN
        RAISE EXCEPTION 'test-injected activity insert failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "${triggerName}"
    BEFORE INSERT ON "Activity"
    FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
  `);

  try {
    await run();
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "Activity";`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"();`);
  }
}

async function setUpTaskWithOwner() {
  const owner = await signUpTestUser(app);
  const { workspace } = await createWorkspaceWithMember(owner.userId);
  const project = await createProjectDirect(workspace.id, owner.userId);
  const task = await createTaskDirect(workspace.id, project.id, owner.userId);

  return { owner, workspace, project, task };
}

async function uploadRealAttachment(
  owner: { cookie: string },
  taskId: string,
  content = "attachment delete consistency probe",
  fileName = "probe.txt",
) {
  const res = await request(app)
    .post(`/api/v1/tasks/${taskId}/attachments`)
    .set("Cookie", owner.cookie)
    .attach("file", Buffer.from(content), fileName)
    .expect(201);

  const attachmentId = res.body.data.attachment.id as string;

  const stored = await prisma.attachment.findUniqueOrThrow({
    where: { id: attachmentId },
    select: { storageKey: true },
  });

  return { attachmentId, storageKey: stored.storageKey };
}

describe("attachment deletion consistency (F-18)", () => {
  let testServer: TestServer;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await testServer.close();
  });

  afterEach(async () => {
    openSockets.forEach((socket) => socket.disconnect());
    openSockets.length = 0;

    await resetDatabase();
  });

  it("deletes the database row, the physical file, and records an ATTACHMENT_DELETED activity", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner();
    const { attachmentId, storageKey } = await uploadRealAttachment(owner, task.id);

    const absolutePath = attachmentFilePath(storageKey);
    expect(await fileExists(absolutePath)).toBe(true);

    await request(app)
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set("Cookie", owner.cookie)
      .expect(204);

    const persistedAttachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    expect(persistedAttachment).toBeNull();

    expect(await fileExists(absolutePath)).toBe(false);

    const persistedActivity = await prisma.activity.findFirst({
      where: {
        workspaceId: workspace.id,
        type: "ATTACHMENT_DELETED",
        entityId: attachmentId,
      },
    });
    expect(persistedActivity).not.toBeNull();
  });

  /**
   * The key F-18 regression test: reproduces the exact failure mode the
   * commit fixes. Under the old storage-first ordering, deleting the
   * physical file out from under an otherwise-intact attachment row made
   * every future delete attempt (including retries) throw FileNotFoundError
   * before ever reaching the database delete - the row became permanently
   * undeletable. With database-first ordering, a missing physical file must
   * not prevent the row from being deleted.
   */
  it("still deletes the database row when the physical file is already missing", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner();
    const { attachmentId, storageKey } = await uploadRealAttachment(owner, task.id);

    const absolutePath = attachmentFilePath(storageKey);
    await fs.unlink(absolutePath);
    expect(await fileExists(absolutePath)).toBe(false);

    await request(app)
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set("Cookie", owner.cookie)
      .expect(204);

    const persistedAttachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    expect(persistedAttachment).toBeNull();

    const persistedActivity = await prisma.activity.findFirst({
      where: {
        workspaceId: workspace.id,
        type: "ATTACHMENT_DELETED",
        entityId: attachmentId,
      },
    });
    expect(persistedActivity).not.toBeNull();
  });

  /**
   * Proves the transaction boundary is real: if the Activity insert inside
   * prisma.$transaction fails, the attachment row must roll back with it
   * (not be left half-deleted), no ATTACHMENT_DELETED event may reach a
   * connected client, and - since storage cleanup only runs after the
   * transaction commits - the physical file must be untouched too.
   */
  it("rolls back the attachment deletion and never emits ATTACHMENT_DELETED when the transaction fails", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner();
    const { attachmentId, storageKey } = await uploadRealAttachment(owner, task.id);
    const absolutePath = attachmentFilePath(storageKey);

    const socket = await connectTestSocket(testServer.baseUrl, owner.cookie);
    openSockets.push(socket);

    // Confirms the socket has actually joined the workspace room before the
    // real check below - a fresh connection can't assume its room join has
    // landed yet (see waitForEventWithRetries's own comment).
    await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_CREATED, () =>
      emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
        marker: "confirm-joined",
      }),
    );

    const forbidden = trackEvent(socket, REALTIME_EVENTS.ATTACHMENT_DELETED);

    await withActivityInsertFailure(owner.userId, "ATTACHMENT_DELETED", async () => {
      const res = await request(app)
        .delete(`/api/v1/attachments/${attachmentId}`)
        .set("Cookie", owner.cookie);

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.success).toBe(false);
    });

    // Liveness proof: a genuine, independently-emitted event on this same
    // socket, sent after the failing request has fully resolved, must still
    // arrive - otherwise "forbidden was never received" would just mean the
    // socket was dead, not that the deletion event was withheld.
    emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
      marker: "liveness-check",
    });
    await waitForEvent(socket, REALTIME_EVENTS.PROJECT_CREATED);

    expect(forbidden.wasReceived()).toBe(false);
    forbidden.stop();

    const persistedAttachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    expect(persistedAttachment).not.toBeNull();

    const persistedActivity = await prisma.activity.findFirst({
      where: {
        workspaceId: workspace.id,
        type: "ATTACHMENT_DELETED",
        entityId: attachmentId,
      },
    });
    expect(persistedActivity).toBeNull();

    // Storage cleanup only runs after a successful commit, so a rolled-back
    // transaction must never have attempted it.
    expect(await fileExists(absolutePath)).toBe(true);

    await fs.unlink(absolutePath);
  });
});
