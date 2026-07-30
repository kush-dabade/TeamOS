import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { deleteAttachment } from "../api/attachments.api";
import { attachmentKeys } from "../lib/attachment-keys";

interface DeleteAttachmentVariables {
  attachmentId: string;
  taskId: string;
}

// `taskId` is required in variables since DELETE /attachments/:id responds
// 204 No Content - there's no response body to recover it from.
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, DeleteAttachmentVariables>({
    mutationFn: ({ attachmentId }) => deleteAttachment(attachmentId),
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
