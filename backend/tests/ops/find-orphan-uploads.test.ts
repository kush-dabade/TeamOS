import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/lib/prisma.js";
import {
  ORPHAN_GRACE_PERIOD_MS,
  deleteOrphanUploads,
  findOrphanUploads,
} from "../../src/ops/find-orphan-uploads.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createAttachmentDirect,
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  fileExists,
} from "../setup/fixtures.js";

let root: string;

async function writeStoredFile(storageKey: string, ageMs = 0) {
  const absolute = path.join(root, storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, "x");
  const mtime = new Date(Date.now() - ageMs);
  await utimes(absolute, mtime, mtime);
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "orphan-uploads-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await resetDatabase();
});

describe("findOrphanUploads", () => {
  it("lists only files no attachment or avatar references", async () => {
    const user = await prisma.user.create({
      data: { id: `orphan-test-${crypto.randomUUID()}`, name: "Owner", email: `${crypto.randomUUID()}@example.com` },
    });
    const { workspace } = await createWorkspaceWithMember(user.id);
    const project = await createProjectDirect(workspace.id, user.id);
    const task = await createTaskDirect(workspace.id, project.id, user.id);
    const attachment = await createAttachmentDirect(workspace.id, task.id, user.id);

    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { storageKey: `workspaces/${workspace.id}/kept.txt` },
    });
    await prisma.user.update({ where: { id: user.id }, data: { image: `avatars/${user.id}/a.png` } });

    await writeStoredFile(`workspaces/${workspace.id}/kept.txt`);
    await writeStoredFile(`avatars/${user.id}/a.png`);
    await writeStoredFile("workspaces/deleted-workspace/orphan.txt");
    await writeStoredFile(".gitkeep");

    const orphans = await findOrphanUploads(root);

    expect(orphans.map((orphan) => orphan.storageKey)).toEqual([
      "workspaces/deleted-workspace/orphan.txt",
    ]);
  });

  it("reports nothing for a missing storage root", async () => {
    await expect(findOrphanUploads(path.join(root, "absent"))).resolves.toEqual([]);
  });
});

describe("deleteOrphanUploads", () => {
  it("deletes only orphans older than the grace period", async () => {
    await writeStoredFile("old/orphan.txt", ORPHAN_GRACE_PERIOD_MS + 60_000);
    await writeStoredFile("recent/orphan.txt", 60_000);

    const orphans = await findOrphanUploads(root);
    const { deleted, skippedRecent } = await deleteOrphanUploads(root, orphans);

    expect(deleted.map((file) => file.storageKey)).toEqual(["old/orphan.txt"]);
    expect(skippedRecent.map((file) => file.storageKey)).toEqual(["recent/orphan.txt"]);
    await expect(fileExists(path.join(root, "old/orphan.txt"))).resolves.toBe(false);
    await expect(fileExists(path.join(root, "recent/orphan.txt"))).resolves.toBe(true);
  });
});
