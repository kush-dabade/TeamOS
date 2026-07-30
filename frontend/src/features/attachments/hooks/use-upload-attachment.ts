import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { uploadAttachment } from "../api/attachments.api";
import { attachmentKeys } from "../lib/attachment-keys";
import type { Attachment } from "../types";

interface UploadAttachmentVariables {
  taskId: string;
  file: File;
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation<Attachment, AppError, UploadAttachmentVariables>({
    mutationFn: ({ taskId, file }) => uploadAttachment(taskId, file),
    onSuccess: (_attachment, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
