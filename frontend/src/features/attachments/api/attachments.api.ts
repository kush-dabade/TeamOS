import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Attachment } from "../types";

export async function fetchTaskAttachments(taskId: string): Promise<Attachment[]> {
  const response = await apiClient.get<ApiSuccess<{ attachments: Attachment[] }>>(
    `/tasks/${taskId}/attachments`,
  );

  return response.data.data.attachments;
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
