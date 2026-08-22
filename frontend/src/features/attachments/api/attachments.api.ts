import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Attachment } from "../types";

export interface AttachmentPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// The attachment list endpoint's envelope nests results under
// `data.attachments` with a sibling `pagination` block, matching the
// Tasks/Comments list endpoints' own local response shape - not a shared
// generic type, since none of those endpoints use one either.
interface AttachmentListResponse {
  success: true;
  data: {
    attachments: Attachment[];
  };
  pagination: AttachmentPagination;
}

export interface ListTaskAttachmentsParams {
  page?: number;
  limit?: number;
}

export interface ListTaskAttachmentsResult {
  attachments: Attachment[];
  pagination: AttachmentPagination;
}

export async function fetchTaskAttachments(
  taskId: string,
  params: ListTaskAttachmentsParams = {},
): Promise<ListTaskAttachmentsResult> {
  const response = await apiClient.get<AttachmentListResponse>(`/tasks/${taskId}/attachments`, {
    params,
  });

  return {
    attachments: response.data.data.attachments,
    pagination: response.data.pagination,
  };
}

export async function uploadAttachment(taskId: string, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<ApiSuccess<{ attachment: Attachment }>>(
    `/tasks/${taskId}/attachments`,
    formData,
  );

  return response.data.data.attachment;
}

// The backend responds 204 No Content on delete (no envelope body to parse).
export async function deleteAttachment(attachmentId: string): Promise<void> {
  await apiClient.delete(`/attachments/${attachmentId}`);
}
