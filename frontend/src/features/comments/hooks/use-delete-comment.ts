import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { deleteComment } from "../api/comments.api";
import { commentKeys } from "../lib/comment-keys";

interface DeleteCommentVariables {
  commentId: string;
  taskId: string;
}

// `taskId` is required in variables since DELETE /comments/:id responds
// 204 No Content - there's no response body to recover it from.
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, DeleteCommentVariables>({
    mutationFn: ({ commentId }) => deleteComment(commentId),
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
