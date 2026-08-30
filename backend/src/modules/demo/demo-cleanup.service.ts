import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";

export interface DemoCleanupResult {
  expiredUserCount: number;
  deletedWorkspaceCount: number;
  deletedUserCount: number;
}

// Safety cap on how many expired identities one sweep processes - not an
// expected-normal-operation limit (demo volume at this application's scale
// should never come close), just a bound on how much work a single tick
// can do. Any remainder is picked up by the next scheduled run 15 minutes
// later (see queues/demo-cleanup/demo-cleanup.queue.ts).
const CLEANUP_BATCH_SIZE = 200;

/**
 * Finds every demo User past its demoExpiresAt and removes it, along with
 * every Workspace it owns.
 *
 * Order matters: Workspace(s) are deleted BEFORE the User. Project.owner,
 * Task.createdBy, Comment.author, and Attachment.uploadedBy are all
 * onDelete: Restrict from User (verified against
 * prisma/migrations/20260603104013_add_workspace_models and the schema's
 * current FKs) - a demo user can never be deleted while a Project/Task/
 * Comment/Attachment they created still references them. Every one of
 * those is workspace-scoped with onDelete: Cascade FROM Workspace, so
 * deleting the workspace(s) first removes all of it in one statement per
 * table at the database level; only then does nothing reference the User
 * row anymore, and it can be deleted too.
 *
 * `deleteMany` (never `delete`) on both statements is what makes this
 * idempotent: a workspace or user already removed by an earlier,
 * interrupted, or concurrently-running sweep simply matches zero rows
 * instead of throwing P2025.
 *
 * Not wrapped in a single prisma.$transaction across all expired users -
 * each user's cleanup is already two statements that are individually
 * idempotent and re-attempted on a later sweep if this run is interrupted
 * partway; one user's cleanup failing is caught and logged so it doesn't
 * abort the rest of the batch.
 */
export async function cleanupExpiredDemoSessions(): Promise<DemoCleanupResult> {
  const expiredUsers = await prisma.user.findMany({
    where: {
      isDemo: true,
      demoExpiresAt: { lte: new Date() },
    },
    select: { id: true },
    take: CLEANUP_BATCH_SIZE,
  });

  let deletedWorkspaceCount = 0;
  let deletedUserCount = 0;

  for (const { id: userId } of expiredUsers) {
    try {
      const { count: workspaceCount } = await prisma.workspace.deleteMany({
        where: { ownerId: userId },
      });

      const { count: userCount } = await prisma.user.deleteMany({
        where: { id: userId, isDemo: true },
      });

      deletedWorkspaceCount += workspaceCount;
      deletedUserCount += userCount;
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to clean up expired demo session");
    }
  }

  const result: DemoCleanupResult = {
    expiredUserCount: expiredUsers.length,
    deletedWorkspaceCount,
    deletedUserCount,
  };

  if (expiredUsers.length > 0) {
    logger.info(result, "Demo cleanup sweep completed");
  }

  return result;
}
