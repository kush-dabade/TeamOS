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
import { fileExists, setUpTaskWithOwner } from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  trackEvent,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

// Mirrors LocalStorageProvider's own resolveAbsolutePath (private, not
// exported) - see the identical helper in
// tests/attachment/attachment-delete-consistency.test.ts. Kept local (not
// moved to fixtures.ts) since it's only meaningful to attachment-storage
// tests, unlike fileExists/setUpTaskWithOwner.
function attachmentFilePath(storageKey: string): string {
  return path.resolve(path.resolve(storageConfig.rootDirectory), storageKey);
}

// Direct Prisma write, same rationale as every other *Direct fixture in
// tests/setup/fixtures.ts - archiving has no security-sensitive internals
// worth exercising through the HTTP layer just to set up a test fixture.
async function archiveProjectDirect(projectId: string) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });
}

describe("attachment mutations on archived projects (P2-ARCH)", () => {
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

    // Guarantees storage cleanup even when an assertion above throws mid-test
    // - unlike each test's own upload flow, this always runs.
    await fs.rm(path.resolve(storageConfig.rootDirectory, "workspaces"), {
      recursive: true,
      force: true,
    });

    await resetDatabase();
  });

  it("rejects uploading an attachment to a task in an archived project, before any storage or database side effect", async () => {
    const { owner, workspace, task, project } = await setUpTaskWithOwner(app);
    await archiveProjectDirect(project.id);

    const socket = await connectTestSocket(testServer.baseUrl, owner.cookie);
    openSockets.push(socket);

    await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_CREATED, () =>
      emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
        marker: "confirm-joined",
      }),
    );

    const forbidden = trackEvent(socket, REALTIME_EVENTS.ATTACHMENT_UPLOADED);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from("should never be written"), "blocked.txt")
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Archived projects cannot be modified");

    // Liveness proof, same technique as attachment-delete-consistency.test.ts.
    emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
      marker: "liveness-check",
    });
    await waitForEvent(socket, REALTIME_EVENTS.PROJECT_CREATED);

    expect(forbidden.wasReceived()).toBe(false);
    forbidden.stop();

    const persistedAttachment = await prisma.attachment.findFirst({
      where: { taskId: task.id },
    });
    expect(persistedAttachment).toBeNull();

    const persistedActivity = await prisma.activity.findFirst({
      where: { workspaceId: workspace.id, type: "ATTACHMENT_UPLOADED" },
    });
    expect(persistedActivity).toBeNull();

    // No storage side effect means there is nowhere to even look for a
    // stray file - the task's whole attachment directory must not exist.
    const taskDirectory = path.resolve(
      path.resolve(storageConfig.rootDirectory),
      `workspaces/${workspace.id}/tasks/${task.id}`,
    );
    expect(await fileExists(taskDirectory)).toBe(false);
  });

  it("rejects deleting an attachment once its project is archived, leaving the database row and physical file intact", async () => {
    const { owner, workspace, task, project } = await setUpTaskWithOwner(app);

    // Upload while the project is still active - upload itself would be
    // blocked by the same guard once archived, so the attachment has to
    // exist before archival happens.
    const uploadRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from("archived project delete probe"), "probe.txt")
      .expect(201);

    const attachmentId = uploadRes.body.data.attachment.id as string;
    const stored = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachmentId },
      select: { storageKey: true },
    });
    const absolutePath = attachmentFilePath(stored.storageKey);
    expect(await fileExists(absolutePath)).toBe(true);

    await archiveProjectDirect(project.id);

    const socket = await connectTestSocket(testServer.baseUrl, owner.cookie);
    openSockets.push(socket);

    await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_CREATED, () =>
      emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
        marker: "confirm-joined",
      }),
    );

    const forbidden = trackEvent(socket, REALTIME_EVENTS.ATTACHMENT_DELETED);

    const res = await request(app)
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set("Cookie", owner.cookie)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Archived projects cannot be modified");

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

    expect(await fileExists(absolutePath)).toBe(true);

    const persistedActivity = await prisma.activity.findFirst({
      where: {
        workspaceId: workspace.id,
        type: "ATTACHMENT_DELETED",
        entityId: attachmentId,
      },
    });
    expect(persistedActivity).toBeNull();
  });

  it("still allows downloading an attachment from an archived project", async () => {
    const { owner, task, project } = await setUpTaskWithOwner(app);

    const uploadRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from("still downloadable"), "readable.txt")
      .expect(201);

    const attachmentId = uploadRes.body.data.attachment.id as string;

    await archiveProjectDirect(project.id);

    const downloadRes = await request(app)
      .get(`/api/v1/attachments/${attachmentId}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(downloadRes.text).toBe("still downloadable");
  });

  it("still allows listing attachments on an archived project", async () => {
    const { owner, task, project } = await setUpTaskWithOwner(app);

    const uploadRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from("still listable"), "listable.txt")
      .expect(201);

    const attachmentId = uploadRes.body.data.attachment.id as string;

    await archiveProjectDirect(project.id);

    const listRes = await request(app)
      .get(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(listRes.body.data.attachments).toHaveLength(1);
    expect(listRes.body.data.attachments[0].id).toBe(attachmentId);
  });
});
