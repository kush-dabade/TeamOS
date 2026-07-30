import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation<Comment, AppError, UpdateCommentVariables>({
    mutationFn: ({ commentId, input }) => updateComment(commentId, input),
    onSuccess: (_comment, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
