import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { storageConfig } from "../../src/storage/index.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  setUpTaskWithOwner,
  signUpTestUser,
} from "../setup/fixtures.js";

import { ATTACHMENT_MAX_FILE_SIZE } from "../../src/modules/attachment/attachment.config.js";

// Same computation as tests/attachment/attachment-archived-project.test.ts's
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

describe("attachment upload validation", () => {
  afterEach(async () => {
    // Guarantees storage cleanup even if an assertion above throws mid-test
    // - same rationale as the sibling attachment test files' afterEach.
    await fs.rm(path.resolve(storageConfig.rootDirectory, "workspaces"), {
      recursive: true,
      force: true,
    });

    await resetDatabase();
  });

  it("rejects a file over the configured 10MB size limit, and creates no attachment row or storage side effect", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    const oversizedBuffer = Buffer.alloc(ATTACHMENT_MAX_FILE_SIZE + 1, "a");

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", oversizedBuffer, "oversized-file.bin")
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe(
      "Uploaded file exceeds the maximum allowed size.",
    );

    const persistedAttachment = await prisma.attachment.findFirst({
      where: { taskId: task.id },
    });
    expect(persistedAttachment).toBeNull();

    expect(await directoryExists(taskAttachmentDirectory(workspace.id, task.id))).toBe(
      false,
    );
  });

  it("rejects an unsupported MIME type, and creates no attachment row or storage side effect", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from("not an allowed type"), {
        filename: "malware.exe",
        contentType: "application/octet-stream",
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Unsupported attachment file type.");

    const persistedAttachment = await prisma.attachment.findFirst({
      where: { taskId: task.id },
    });
    expect(persistedAttachment).toBeNull();

    expect(await directoryExists(taskAttachmentDirectory(workspace.id, task.id))).toBe(
      false,
    );
  });

  it("rejects a GUEST uploading an attachment, and creates no attachment row", async () => {
    const { workspace, task } = await setUpTaskWithOwner(app);
    const guest = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", guest.cookie)
      .attach("file", Buffer.from("guests should not upload this"), "note.txt")
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toBe("Guests cannot upload attachments.");

    const persistedAttachment = await prisma.attachment.findFirst({
      where: { taskId: task.id },
    });
    expect(persistedAttachment).toBeNull();
  });
});
