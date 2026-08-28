import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { createComment, type CreateCommentInput } from "../api/comments.api";
import { commentKeys } from "../lib/comment-keys";
import type { Comment } from "../types";

interface CreateCommentVariables {
  taskId: string;
  input: CreateCommentInput;
}

// No onError toast: comment creation is form-backed - CommentForm's own
// try/catch surfaces the failure inline via form.setError("root"), so a
// toast here would double-report the error.
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation<Comment, AppError, CreateCommentVariables>({
    mutationFn: ({ taskId, input }) => createComment(taskId, input),
    onSuccess: (_comment, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}
