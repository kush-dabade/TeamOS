import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchTaskComments } from "../api/comments.api";
import { commentKeys } from "../lib/comment-keys";
import type { Comment } from "../types";

// The max page size GET /tasks/:taskId/comments accepts - used here purely
// to minimize how many round trips fetchAllTaskComments needs, not as a
// ceiling: every page is walked to completion below, so a task with more
// comments than this just takes more (parallel) requests, it never loses
// any. Mirrors use-tasks.ts's identical fetchAllWorkspaceTasks pattern.
const PAGE_LIMIT = 100;

/**
 * Removes duplicate ids from the merged pages, keeping each item's first
 * occurrence (and therefore its original position) - offset pagination has
 * no snapshot isolation across the separate requests below, so a comment
 * created between the first page's request and a later page's can shift
 * every subsequent page's offset by one, re-returning a comment the
 * previous page already included. This only fixes the resulting duplicate
 * (a real problem on its own: duplicate React keys, a comment rendered
 * twice) - it cannot recover a comment a concurrent *deletion* shifted out
 * of every page's window instead, since that row was never fetched at all.
 * Cursor pagination would close that gap too, but is out of scope here.
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
 * Fetches every comment on a task by walking GET /tasks/:taskId/comments to
 * completion, rather than exposing pagination state to callers - the
 * product's task detail panel (CommentsPanel) renders the complete thread
 * inline, not a paginated feed. The first page reveals the total page
 * count; any remaining pages are then fetched in parallel rather than
 * walked one at a time, keeping total latency roughly constant regardless
 * of how many pages a heavily-commented task needs.
 */
async function fetchAllTaskComments(taskId: string): Promise<Comment[]> {
  const firstPage = await fetchTaskComments(taskId, { page: 1, limit: PAGE_LIMIT });

  if (firstPage.pagination.pages <= 1) {
    return firstPage.comments;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.pages - 1 }, (_, index) =>
      fetchTaskComments(taskId, { page: index + 2, limit: PAGE_LIMIT }),
    ),
  );

  return dedupeById([...firstPage.comments, ...remainingPages.flatMap((page) => page.comments)]);
}

export function useComments(taskId: string | undefined) {
  return useQuery<Comment[], AppError>({
    queryKey: commentKeys.list(taskId ?? ""),
    queryFn: () => fetchAllTaskComments(taskId as string),
    enabled: Boolean(taskId),
  });
}
