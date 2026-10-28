import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { FileNotFoundError } from "../../storage/errors/file-not-found.error.js";
import { storageService } from "../../storage/storage.service.js";

export interface DemoCleanupResult {
  expiredUserCount: number;
  deletedWorkspaceCount: number;
  deletedUserCount: number;
  deletedFileCount: number;
  failedFileDeletionCount: number;
}

// Safety cap on how many expired identities one sweep processes - not an
// expected-normal-operation limit (demo volume at this application's scale
// should never come close), just a bound on how much work a single tick
// can do. Any remainder is picked up by the next scheduled run 15 minutes
// later (see queues/demo-cleanup/demo-cleanup.queue.ts).
const CLEANUP_BATCH_SIZE = 200;

/**
 * Removes a stored file after the rows referencing it are gone. A file that
 * is already missing counts as removed, so a re-run after an interrupted
 * sweep is harmless. Any other failure is logged and reported, never
 * thrown: the database rows are already deleted at this point, so the file
 * is an orphan either way, and failing the sweep would only stop the
 * remaining tenants from being cleaned up. src/ops/find-orphan-uploads.ts
 * lists such leftovers.
 */
async function deleteStoredFile(storageKey: string): Promise<boolean> {
  try {
    await storageService.delete(storageKey);
    return true;
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      return true;
    }

    logger.warn({ err: error, storageKey }, "Failed to delete a demo tenant's stored file");
    return false;
  }
}

/**
 * Finds every demo User past its demoExpiresAt and removes it, every
 * Workspace an expired demo user owns, and the files those rows pointed to.
 *
 * Two phases, in this order, because Project.owner, Task.createdBy,
 * Comment.author and Attachment.uploadedBy are onDelete: Restrict from
 * User:
 *
 *  1. Every workspace owned by an expired demo user. Everything those
 *     restrict-FKs protect is workspace-scoped with onDelete: Cascade from
 *     Workspace, so this removes all of it - including content created by
 *     the session's demo teammates, who own no workspace of their own.
 *  2. The expired users themselves, now unreferenced.
 *
 * Deleting user-by-user instead (each user's workspaces, then that user)
 * failed whenever a teammate was processed before the owner whose
 * workspace still held the teammate's projects and tasks; it only
 * succeeded on a later sweep.
 *
 * Files live outside the database, so they can't share its transaction:
 * storage keys are read before each delete and the files removed only
 * after the rows are gone. A crash in between leaves an orphaned file
 * (harmless, and listable), never a row pointing at a missing file.
 *
 * `deleteMany` keeps every statement idempotent - rows already removed by
 * an earlier, interrupted, or concurrent sweep match nothing. Each
 * workspace and each user is handled separately, so one failure is logged
 * and retried on the next sweep without stopping the rest.
 */
export async function cleanupExpiredDemoSessions(): Promise<DemoCleanupResult> {
  const expiredUsers = await prisma.user.findMany({
    where: {
      isDemo: true,
      demoExpiresAt: { lte: new Date() },
    },
    select: { id: true, image: true },
    take: CLEANUP_BATCH_SIZE,
  });

  const result: DemoCleanupResult = {
    expiredUserCount: expiredUsers.length,
    deletedWorkspaceCount: 0,
    deletedUserCount: 0,
    deletedFileCount: 0,
    failedFileDeletionCount: 0,
  };

  const recordFileDeletion = (deleted: boolean) => {
    if (deleted) {
      result.deletedFileCount += 1;
    } else {
      result.failedFileDeletionCount += 1;
    }
  };

  const expiredWorkspaces = await prisma.workspace.findMany({
    where: { owner: { isDemo: true, demoExpiresAt: { lte: new Date() } } },
    select: { id: true },
    take: CLEANUP_BATCH_SIZE,
  });

  for (const { id: workspaceId } of expiredWorkspaces) {
    try {
      // Soft-deleted attachments included - their files are still on disk.
      const attachments = await prisma.attachment.findMany({
        where: { workspaceId },
        select: { storageKey: true },
      });

      const { count } = await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      result.deletedWorkspaceCount += count;

      for (const { storageKey } of attachments) {
        recordFileDeletion(await deleteStoredFile(storageKey));
      }
    } catch (error) {
      logger.error({ err: error, workspaceId }, "Failed to delete an expired demo workspace");
    }
  }

  for (const { id: userId, image } of expiredUsers) {
    try {
      const { count } = await prisma.user.deleteMany({ where: { id: userId, isDemo: true } });
      result.deletedUserCount += count;

      // `image` holds the avatar's storage key (see user.service.ts).
      if (count > 0 && image) {
        recordFileDeletion(await deleteStoredFile(image));
      }
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to clean up expired demo user");
    }
  }

  if (expiredUsers.length > 0 || expiredWorkspaces.length > 0) {
    logger.info(result, "Demo cleanup sweep completed");
  }

  return result;
}
