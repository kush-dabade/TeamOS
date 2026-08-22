import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchTaskAttachments } from "../api/attachments.api";
import { attachmentKeys } from "../lib/attachment-keys";
import type { Attachment } from "../types";

// The max page size GET /tasks/:taskId/attachments accepts - used here
// purely to minimize how many round trips fetchAllTaskAttachments needs,
// not as a ceiling: every page is walked to completion below, so a task
// with more attachments than this just takes more (parallel) requests, it
// never loses any. Mirrors use-tasks.ts's fetchAllWorkspaceTasks and
// use-comments.ts's fetchAllTaskComments.
const PAGE_LIMIT = 100;

/**
 * Removes duplicate ids from the merged pages, keeping each item's first
 * occurrence (and therefore its original position) - offset pagination has
 * no snapshot isolation across the separate requests below, so an
 * attachment uploaded between the first page's request and a later page's
 * can shift every subsequent page's offset by one, re-returning an
 * attachment the previous page already included. This only fixes the
 * resulting duplicate (a real problem on its own: duplicate React keys, an
 * attachment rendered twice) - it cannot recover an attachment a concurrent
 * *deletion* shifted out of every page's window instead (attachments are
 * hard-deleted), since that row was never fetched at all. Cursor pagination
 * would close that gap too, but is out of scope here.
 */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

/**
 * Fetches every attachment on a task by walking
 * GET /tasks/:taskId/attachments to completion, rather than exposing
 * pagination state to callers - the product's task detail panel
 * (AttachmentsPanel) renders the complete list inline, not a paginated
 * feed. The first page reveals the total page count; any remaining pages
 * are then fetched in parallel rather than walked one at a time, keeping
 * total latency roughly constant regardless of how many pages a
 * heavily-attached task needs.
 */
async function fetchAllTaskAttachments(taskId: string): Promise<Attachment[]> {
  const firstPage = await fetchTaskAttachments(taskId, { page: 1, limit: PAGE_LIMIT });

  if (firstPage.pagination.pages <= 1) {
    return firstPage.attachments;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.pages - 1 }, (_, index) =>
      fetchTaskAttachments(taskId, { page: index + 2, limit: PAGE_LIMIT }),
    ),
  );

  return dedupeById([
    ...firstPage.attachments,
    ...remainingPages.flatMap((page) => page.attachments),
  ]);
}

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery<Attachment[], AppError>({
    queryKey: attachmentKeys.list(taskId ?? ""),
    queryFn: () => fetchAllTaskAttachments(taskId as string),
    enabled: Boolean(taskId),
  });
}
