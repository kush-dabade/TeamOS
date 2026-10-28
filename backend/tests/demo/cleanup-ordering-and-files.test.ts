import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../src/lib/prisma.js";
import { cleanupExpiredDemoSessions } from "../../src/modules/demo/demo-cleanup.service.js";
import { StorageOperationError } from "../../src/storage/errors/storage-operation.error.js";
import { storageService } from "../../src/storage/storage.service.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createAttachmentDirect,
  createCommentDirect,
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
} from "../setup/fixtures.js";

const HOUR_MS = 60 * 60 * 1000;

async function createDemoUser(expiresInMs: number, label: string) {
  const id = `demo-${label}-${crypto.randomUUID()}`;

  return prisma.user.create({
    data: {
      id,
      name: label,
      email: `${id}@teamos.local`,
      emailVerified: true,
      isDemo: true,
      demoExpiresAt: new Date(Date.now() + expiresInMs),
    },
  });
}

async function storeFile(directory: string): Promise<string> {
  const content = Buffer.from("demo cleanup test file");
  const stored = await storageService.upload({
    content,
    directory,
    originalFileName: "file.txt",
    mimeType: "text/plain",
    size: content.length,
  });

  return stored.storageKey;
}

/**
 * A provisioned /try session in miniature: an owner with a workspace, and a
 * demo teammate - owning no workspace - who created a project, a task, a
 * comment and an attachment (with a real file) inside the owner's workspace,
 * plus an avatar file of their own. The teammate's content is what made the
 * old user-by-user cleanup fail on Project_ownerId_fkey / Task_createdById_fkey
 * whenever the teammate was processed before the owner.
 */
async function createDemoTenant(expiresInMs: number) {
  const owner = await createDemoUser(expiresInMs, "owner");
  const teammate = await createDemoUser(expiresInMs, "teammate");

  const { workspace } = await createWorkspaceWithMember(owner.id);
  await addWorkspaceMember(workspace.id, teammate.id);

  const project = await createProjectDirect(workspace.id, teammate.id);
  const task = await createTaskDirect(workspace.id, project.id, teammate.id);
  await createCommentDirect(workspace.id, task.id, teammate.id);

  const attachmentKey = await storeFile(`workspaces/${workspace.id}/attachments`);
  const attachment = await createAttachmentDirect(workspace.id, task.id, teammate.id);
  await prisma.attachment.update({
    where: { id: attachment.id },
    data: { storageKey: attachmentKey },
  });

  const avatarKey = await storeFile(`avatars/${teammate.id}`);
  await prisma.user.update({ where: { id: teammate.id }, data: { image: avatarKey } });

  return { owner, teammate, workspace, attachmentKey, avatarKey };
}

describe("demo cleanup - ordering and stored files", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
  });

  it("removes several expired tenants, teammates included, in a single sweep", async () => {
    const first = await createDemoTenant(-HOUR_MS);
    const second = await createDemoTenant(-HOUR_MS);
    const active = await createDemoTenant(HOUR_MS);

    const result = await cleanupExpiredDemoSessions();

    expect(result).toEqual({
      expiredUserCount: 4,
      deletedWorkspaceCount: 2,
      deletedUserCount: 4,
      deletedFileCount: 4,
      failedFileDeletionCount: 0,
    });

    const remainingExpired = await prisma.user.count({
      where: {
        id: { in: [first.owner.id, first.teammate.id, second.owner.id, second.teammate.id] },
      },
    });
    expect(remainingExpired).toBe(0);

    for (const key of [first.attachmentKey, first.avatarKey, second.attachmentKey, second.avatarKey]) {
      await expect(storageService.exists(key)).resolves.toBe(false);
    }

    // The unexpired tenant, and its files, are untouched.
    await expect(prisma.workspace.count({ where: { id: active.workspace.id } })).resolves.toBe(1);
    await expect(storageService.exists(active.attachmentKey)).resolves.toBe(true);
    await expect(storageService.exists(active.avatarKey)).resolves.toBe(true);
  });

  it("logs no foreign-key failures when the teammate sorts before the owner", async () => {
    await createDemoTenant(-HOUR_MS);

    // The expired-user query has no ORDER BY, so Postgres decides the order;
    // pin the order that used to fail (teammate before owner) instead of
    // depending on how the planner happens to scan.
    const realFindMany = prisma.user.findMany.bind(prisma.user);
    vi.spyOn(prisma.user, "findMany").mockImplementation((async (
      args: Parameters<typeof prisma.user.findMany>[0],
    ) => {
      const users = (await realFindMany(args)) as Array<{ id: string }>;
      return [...users].sort((a, b) => Number(b.id.includes("teammate")) - Number(a.id.includes("teammate")));
    }) as unknown as typeof prisma.user.findMany);

    const errorSpy = vi.spyOn((await import("../../src/lib/logger.js")).logger, "error");

    const result = await cleanupExpiredDemoSessions();

    expect(result.deletedUserCount).toBe(2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("is idempotent: a second sweep finds nothing and a file already gone counts as removed", async () => {
    const tenant = await createDemoTenant(-HOUR_MS);
    await storageService.delete(tenant.avatarKey);

    const firstRun = await cleanupExpiredDemoSessions();
    expect(firstRun).toMatchObject({ deletedFileCount: 2, failedFileDeletionCount: 0 });

    await expect(cleanupExpiredDemoSessions()).resolves.toEqual({
      expiredUserCount: 0,
      deletedWorkspaceCount: 0,
      deletedUserCount: 0,
      deletedFileCount: 0,
      failedFileDeletionCount: 0,
    });
  });

  it("still removes the rows and the other tenants when a file can't be deleted", async () => {
    const failing = await createDemoTenant(-HOUR_MS);
    const healthy = await createDemoTenant(-HOUR_MS);

    const realDelete = storageService.delete.bind(storageService);
    vi.spyOn(storageService, "delete").mockImplementation(async (key: string) => {
      if (key === failing.attachmentKey) {
        throw new StorageOperationError("Failed to delete file.");
      }
      return realDelete(key);
    });

    const result = await cleanupExpiredDemoSessions();

    expect(result).toMatchObject({
      expiredUserCount: 4,
      deletedWorkspaceCount: 2,
      deletedUserCount: 4,
      deletedFileCount: 3,
      failedFileDeletionCount: 1,
    });
    await expect(prisma.workspace.count({ where: { id: failing.workspace.id } })).resolves.toBe(0);
    await expect(storageService.exists(healthy.attachmentKey)).resolves.toBe(false);

    // The undeletable file is now an orphan; remove it so the test leaves no trace.
    vi.restoreAllMocks();
    await storageService.delete(failing.attachmentKey);
  });
});
