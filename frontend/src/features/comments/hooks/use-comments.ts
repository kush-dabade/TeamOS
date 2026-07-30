import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchTaskComments } from "../api/comments.api";
import { commentKeys } from "../lib/comment-keys";
import type { Comment } from "../types";

export function useComments(taskId: string | undefined) {
  return useQuery<Comment[], AppError>({
    queryKey: commentKeys.list(taskId ?? ""),
    queryFn: () => fetchTaskComments(taskId as string),
    enabled: Boolean(taskId),
  });
}
