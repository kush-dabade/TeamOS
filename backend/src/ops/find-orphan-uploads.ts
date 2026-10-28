import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { prisma } from "../lib/prisma.js";
import { storageConfig } from "../storage/storage.config.js";

/**
 * Lists stored files that no database row references - attachments
 * (Attachment.storageKey, soft-deleted rows included) and avatars
 * (user.image). Files were left behind by demo cleanup before it learned to
 * delete them, and can still be left behind if a file deletion fails after
 * its row is gone.
 *
 * Report-only by default. `--delete` removes listed orphans older than the
 * grace period: an upload writes its file before its row, so a very recent
 * unreferenced file may belong to an upload still in flight.
 *
 * In production: dc exec backend node dist/src/ops/find-orphan-uploads.js [--delete]
 */

export const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export interface StoredFile {
  storageKey: string;
  size: number;
  modifiedAt: Date;
}

async function listStoredFiles(rootDirectory: string, relative = ""): Promise<StoredFile[]> {
  const entries = await readdir(path.join(rootDirectory, relative), { withFileTypes: true });
  const files: StoredFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const storageKey = path.posix.join(relative, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listStoredFiles(rootDirectory, storageKey)));
    } else if (entry.isFile()) {
      const stats = await stat(path.join(rootDirectory, storageKey));
      files.push({ storageKey, size: stats.size, modifiedAt: stats.mtime });
    }
  }

  return files;
}

export async function findOrphanUploads(rootDirectory: string): Promise<StoredFile[]> {
  const [attachments, avatars] = await Promise.all([
    prisma.attachment.findMany({ select: { storageKey: true } }),
    prisma.user.findMany({ where: { image: { not: null } }, select: { image: true } }),
  ]);

  const referenced = new Set<string>([
    ...attachments.map((attachment) => attachment.storageKey),
    ...avatars.flatMap((user) => (user.image ? [user.image] : [])),
  ]);

  const files = await listStoredFiles(rootDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  });

  return files.filter((file) => !referenced.has(file.storageKey));
}

export async function deleteOrphanUploads(
  rootDirectory: string,
  orphans: StoredFile[],
  now = Date.now(),
): Promise<{ deleted: StoredFile[]; skippedRecent: StoredFile[] }> {
  const deleted: StoredFile[] = [];
  const skippedRecent: StoredFile[] = [];

  for (const orphan of orphans) {
    if (now - orphan.modifiedAt.getTime() < ORPHAN_GRACE_PERIOD_MS) {
      skippedRecent.push(orphan);
      continue;
    }

    await unlink(path.join(rootDirectory, orphan.storageKey));
    deleted.push(orphan);
  }

  return { deleted, skippedRecent };
}

// An operator CLI's output is its interface, so it writes to stdout
// directly rather than through the structured application logger.
function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const shouldDelete = process.argv.includes("--delete");
  const rootDirectory = path.resolve(storageConfig.rootDirectory);

  try {
    const orphans = await findOrphanUploads(rootDirectory);
    const totalBytes = orphans.reduce((sum, orphan) => sum + orphan.size, 0);

    for (const orphan of orphans) {
      print(
        `orphan ${orphan.storageKey} ${orphan.size}B modified ${orphan.modifiedAt.toISOString()}`,
      );
    }
    print(`${orphans.length} orphaned file(s), ${totalBytes} bytes, under ${rootDirectory}`);

    if (!shouldDelete) {
      print("Report only. Re-run with --delete to remove orphans older than 24 hours.");
      return;
    }

    const { deleted, skippedRecent } = await deleteOrphanUploads(rootDirectory, orphans);
    print(
      `Deleted ${deleted.length} orphaned file(s); kept ${skippedRecent.length} newer than 24 hours.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  });
}
