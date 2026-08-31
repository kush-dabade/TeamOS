import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { storageConfig } from "../../src/storage/index.js";
import { DEMO_ATTACHMENT_MAX_FILE_SIZE } from "../../src/modules/attachment/attachment.config.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  setUpTaskWithOwner,
  signUpDemoTestUser,
} from "../setup/fixtures.js";

// Same computation as tests/attachment/attachment-validation.test.ts's
// identical helper: the directory a successful upload for this task would
// have been written into (attachment.service.ts's buildAttachmentDirectory).
// Its non-existence is what proves a rejected upload never reached
// storageService.upload() at all.
function taskAttachmentDirectory(workspaceId: string, taskId: string): string {
  return path.resolve(
    path.resolve(storageConfig.rootDirectory),
    `workspaces/${workspaceId}/tasks/${taskId}`,
  );
}

async function directoryExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Commit 5: a demo identity (modules/demo/, Commit 3) is otherwise a
 * completely normal workspace OWNER, so without this an anonymous,
 * free-to-create demo session could use the real attachment pipeline as
 * unrestricted file storage up to the shared 10MB ceiling. This is an
 * ADDITIONAL, tighter bound layered on top of that shared limit - it does
 * not replace or weaken it for real users (attachment-validation.test.ts's
 * 10MB test is untouched).
 */
describe("demo attachment size limit", () => {
  afterEach(async () => {
    await fs.rm(path.resolve(storageConfig.rootDirectory, "workspaces"), {
      recursive: true,
      force: true,
    });

    await resetDatabase();
  });

  async function setUpDemoTaskOwner() {
    const owner = await signUpDemoTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);

    return { owner, workspace, task };
  }

  it("allows a demo user to upload an attachment within the demo size limit", async () => {
    const { owner, task } = await setUpDemoTaskOwner();

    const withinLimitBuffer = Buffer.alloc(DEMO_ATTACHMENT_MAX_FILE_SIZE - 1, "a");

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", withinLimitBuffer, "demo-note.txt")
      .expect(201);

    expect(res.body.success).toBe(true);

    const persisted = await prisma.attachment.findFirst({ where: { taskId: task.id } });
    expect(persisted).not.toBeNull();
  });

  it(
    "rejects a demo upload over the demo size limit (but still under the shared 10MB ceiling), " +
      "and creates no attachment row or storage side effect",
    async () => {
      const { owner, workspace, task } = await setUpDemoTaskOwner();

      const overDemoLimitBuffer = Buffer.alloc(DEMO_ATTACHMENT_MAX_FILE_SIZE + 1, "a");

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/attachments`)
        .set("Cookie", owner.cookie)
        .attach("file", overDemoLimitBuffer, "too-big-for-demo.txt")
        .expect(400);

      expect(res.body).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Demo workspaces are limited to attachments up to ${
            DEMO_ATTACHMENT_MAX_FILE_SIZE / (1024 * 1024)
          }MB.`,
        },
      });

      const persistedAttachment = await prisma.attachment.findFirst({
        where: { taskId: task.id },
      });
      expect(persistedAttachment).toBeNull();

      expect(await directoryExists(taskAttachmentDirectory(workspace.id, task.id))).toBe(false);
    },
  );

  it("leaves real-user attachment behavior unchanged (up to the shared 10MB limit, unaffected by the demo limit)", async () => {
    const { owner, task } = await setUpTaskWithOwner(app);

    // Bigger than the demo limit, still well under the real 10MB ceiling -
    // this must succeed for a real (non-demo) user.
    const buffer = Buffer.alloc(DEMO_ATTACHMENT_MAX_FILE_SIZE + 1024, "a");

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", buffer, "real-user-file.txt")
      .expect(201);

    expect(res.body.success).toBe(true);
  });
});
