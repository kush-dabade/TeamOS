import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { createComment, type CreateCommentInput } from "../api/comments.api";
import { commentKeys } from "../lib/comment-keys";
import type { Comment } from "../types";

interface CreateCommentVariables {
  taskId: string;
  input: CreateCommentInput;
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation<Comment, AppError, CreateCommentVariables>({
    mutationFn: ({ taskId, input }) => createComment(taskId, input),
    onSuccess: (_comment, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
