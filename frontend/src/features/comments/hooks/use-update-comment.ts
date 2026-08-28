import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { updateComment, type UpdateCommentInput } from "../api/comments.api";
import { commentKeys } from "../lib/comment-keys";
import type { Comment } from "../types";

interface UpdateCommentVariables {
  commentId: string;
  taskId: string;
  input: UpdateCommentInput;
}

// `taskId` is required in variables (not derived from the response) because
// the backend's comment resource doesn't include it - PATCH /comments/:id
// returns only { id, content, createdAt, updatedAt, author }.
//
// No onError toast, for the same reason as useCreateComment: this backs
// CommentForm's edit flow, which already has its own inline error slot.
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation<Comment, AppError, UpdateCommentVariables>({
    mutationFn: ({ commentId, input }) => updateComment(commentId, input),
    onSuccess: (_comment, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}
