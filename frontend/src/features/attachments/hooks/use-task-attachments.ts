import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchTaskAttachments } from "../api/attachments.api";
import { attachmentKeys } from "../lib/attachment-keys";
import type { Attachment } from "../types";

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery<Attachment[], AppError>({
    queryKey: attachmentKeys.list(taskId ?? ""),
    queryFn: () => fetchTaskAttachments(taskId as string),
    enabled: Boolean(taskId),
  });
}
