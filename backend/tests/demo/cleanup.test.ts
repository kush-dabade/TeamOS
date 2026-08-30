import { afterEach, describe, expect, it } from "vitest";

import { cleanupExpiredDemoSessions } from "../../src/modules/demo/demo-cleanup.service.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createCommentDirect,
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
} from "../setup/fixtures.js";

const HOUR_MS = 60 * 60 * 1000;

interface UserOverrides {
  isDemo?: boolean;
  demoExpiresAt?: Date | null;
}

/**
 * Direct Prisma inserts (User has no Better Auth adapter step to go
 * through for this - same "direct data insert, real code path for the
 * assertion" philosophy as fixtures.ts), then the existing
 * createWorkspaceWithMember/createProjectDirect/createTaskDirect/
 * createCommentDirect fixtures for a small but real dependency chain
 * across every one of the onDelete: Restrict-from-User models
 * (Project.owner, Task.createdBy, Comment.author) that make deletion
 * order matter for demo-cleanup.service.ts.
 */
async function createUserWithWorkspace(overrides: UserOverrides = {}) {
  const id = `demo-cleanup-test-${crypto.randomUUID()}`;

  const user = await prisma.user.create({
    data: {
      id,
      name: "Demo Cleanup Test User",
      email: `${id}@example.com`,
      emailVerified: true,
      isDemo: overrides.isDemo ?? false,
      demoExpiresAt: overrides.demoExpiresAt ?? null,
    },
  });

  const { workspace } = await createWorkspaceWithMember(user.id);
  const project = await createProjectDirect(workspace.id, user.id);
  const task = await createTaskDirect(workspace.id, project.id, user.id);
  const comment = await createCommentDirect(workspace.id, task.id, user.id);

  return { user, workspace, project, task, comment };
}

async function existsAll(entities: {
  userId: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  commentId: string;
}): Promise<boolean> {
  const [user, workspace, project, task, comment] = await Promise.all([
    prisma.user.findUnique({ where: { id: entities.userId } }),
    prisma.workspace.findUnique({ where: { id: entities.workspaceId } }),
    prisma.project.findUnique({ where: { id: entities.projectId } }),
    prisma.task.findUnique({ where: { id: entities.taskId } }),
    prisma.comment.findUnique({ where: { id: entities.commentId } }),
  ]);

  return Boolean(user && workspace && project && task && comment);
}

describe("demo cleanup", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it(
    "removes an expired demo user's workspace and all owned data, and leaves a " +
      "non-expired demo user and a normal user untouched",
    async () => {
      const expiredDemo = await createUserWithWorkspace({
        isDemo: true,
        demoExpiresAt: new Date(Date.now() - HOUR_MS),
      });

      const activeDemo = await createUserWithWorkspace({
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + HOUR_MS),
      });

      const normalUser = await createUserWithWorkspace();

      const result = await cleanupExpiredDemoSessions();

      expect(result).toEqual({
        expiredUserCount: 1,
        deletedWorkspaceCount: 1,
        deletedUserCount: 1,
      });

      await expect(
        existsAll({
          userId: expiredDemo.user.id,
          workspaceId: expiredDemo.workspace.id,
          projectId: expiredDemo.project.id,
          taskId: expiredDemo.task.id,
          commentId: expiredDemo.comment.id,
        }),
      ).resolves.toBe(false);

      // Cascade proof, not just "the user is gone": the workspace and
      // every one of its Restrict-from-User-referencing children (project,
      // task, comment) must be gone too, in the order that makes User
      // deletion possible at all (see demo-cleanup.service.ts's own
      // comment on why Workspace must go first).
      const [orphanProject, orphanTask, orphanComment] = await Promise.all([
        prisma.project.findUnique({ where: { id: expiredDemo.project.id } }),
        prisma.task.findUnique({ where: { id: expiredDemo.task.id } }),
        prisma.comment.findUnique({ where: { id: expiredDemo.comment.id } }),
      ]);

      expect(orphanProject).toBeNull();
      expect(orphanTask).toBeNull();
      expect(orphanComment).toBeNull();

      await expect(
        existsAll({
          userId: activeDemo.user.id,
          workspaceId: activeDemo.workspace.id,
          projectId: activeDemo.project.id,
          taskId: activeDemo.task.id,
          commentId: activeDemo.comment.id,
        }),
      ).resolves.toBe(true);

      await expect(
        existsAll({
          userId: normalUser.user.id,
          workspaceId: normalUser.workspace.id,
          projectId: normalUser.project.id,
          taskId: normalUser.task.id,
          commentId: normalUser.comment.id,
        }),
      ).resolves.toBe(true);
    },
  );

  it("is safe to run twice - the second run finds nothing left to clean and does not throw", async () => {
    const expiredDemo = await createUserWithWorkspace({
      isDemo: true,
      demoExpiresAt: new Date(Date.now() - HOUR_MS),
    });

    const firstRun = await cleanupExpiredDemoSessions();

    expect(firstRun).toEqual({
      expiredUserCount: 1,
      deletedWorkspaceCount: 1,
      deletedUserCount: 1,
    });

    await expect(cleanupExpiredDemoSessions()).resolves.toEqual({
      expiredUserCount: 0,
      deletedWorkspaceCount: 0,
      deletedUserCount: 0,
    });

    const user = await prisma.user.findUnique({ where: { id: expiredDemo.user.id } });

    expect(user).toBeNull();
  });
});
