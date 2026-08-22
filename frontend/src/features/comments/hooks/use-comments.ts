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

  return [...firstPage.comments, ...remainingPages.flatMap((page) => page.comments)];
}

export function useComments(taskId: string | undefined) {
  return useQuery<Comment[], AppError>({
    queryKey: commentKeys.list(taskId ?? ""),
    queryFn: () => fetchAllTaskComments(taskId as string),
    enabled: Boolean(taskId),
  });
}
