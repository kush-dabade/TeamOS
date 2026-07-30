import { env } from "@/lib/env";

// The download endpoint streams the raw file (Content-Disposition: attachment)
// rather than a JSON envelope, so it's navigated to directly via an anchor tag
// instead of being fetched through apiClient. The session cookie rides along
// automatically since this is a top-level browser navigation, not an XHR.
export function getAttachmentDownloadUrl(attachmentId: string): string {
  return `${env.apiUrl}/api/v1/attachments/${attachmentId}`;
}
