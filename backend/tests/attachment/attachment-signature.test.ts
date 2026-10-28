import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { storageConfig } from "../../src/storage/index.js";

import { resetDatabase } from "../setup/reset-database.js";
import { pngBytes, setUpTaskWithOwner, signUpTestUser } from "../setup/fixtures.js";

// Regression (audit F-10): uploads were validated only by the MIME type the
// client declared, so arbitrary bytes could be stored as an "image/png".
describe("upload content signature validation", () => {
  afterEach(async () => {
    await fs.rm(path.resolve(storageConfig.rootDirectory, "workspaces"), {
      recursive: true,
      force: true,
    });
    await resetDatabase();
  });

  it("rejects an attachment whose bytes don't match its declared type, storing nothing", async () => {
    const { owner, task } = await setUpTaskWithOwner(app);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from("<html><script>alert(1)</script></html>"), {
        filename: "diagram.png",
        contentType: "image/png",
      })
      .expect(400);

    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "The file's contents don't match its file type.",
    });
    await expect(prisma.attachment.count({ where: { taskId: task.id } })).resolves.toBe(0);
  });

  it("still accepts an attachment whose bytes match", async () => {
    const { owner, task } = await setUpTaskWithOwner(app);

    await request(app)
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set("Cookie", owner.cookie)
      .attach("file", pngBytes("diagram"), { filename: "diagram.png", contentType: "image/png" })
      .expect(201);

    await expect(prisma.attachment.count({ where: { taskId: task.id } })).resolves.toBe(1);
  });

  it("rejects an avatar whose bytes don't match its declared type, leaving the profile unchanged", async () => {
    const user = await signUpTestUser(app);

    const res = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Cookie", user.cookie)
      .attach("file", Buffer.from("this is not a png"), {
        filename: "avatar.png",
        contentType: "image/png",
      })
      .expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { image: true },
    });
    expect(stored.image).toBeNull();
  });
});
