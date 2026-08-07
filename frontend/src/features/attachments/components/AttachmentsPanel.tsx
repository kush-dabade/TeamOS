import { useState } from "react";

import { Card, CardAction, CardContent, CardHeader } from "@/components/ui";

import { AttachmentList } from "./AttachmentList";
import { AttachmentUpload } from "./AttachmentUpload";
import { useDeleteAttachment } from "../hooks/use-delete-attachment";
import { useTaskAttachments } from "../hooks/use-task-attachments";
import { useUploadAttachment } from "../hooks/use-upload-attachment";

interface AttachmentsPanelProps {
  taskId: string;
}

// The only stateful attachments component. Owns the list query and both
// mutations - AttachmentList/AttachmentItem/AttachmentUpload are
// presentational and never call a hook from ../hooks or ../api directly.
export function AttachmentsPanel({ taskId }: AttachmentsPanelProps) {
  const attachmentsQuery = useTaskAttachments(taskId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    await uploadAttachment.mutateAsync({ taskId, file });
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingAttachmentId(attachmentId);

    try {
      await deleteAttachment.mutateAsync({ attachmentId, taskId });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  // Exactly one upload trigger is ever visible: the header action once
  // attachments exist, the empty state's own CTA while the list is empty (or
  // still loading, since we don't yet know which state applies).
  const hasAttachments = (attachmentsQuery.data?.length ?? 0) > 0;

  return (
    <Card size="sm">
      <CardHeader className="mb-3">
        <h3 className="text-sm font-medium">Attachments</h3>
        {hasAttachments ? (
          <CardAction>
            <AttachmentUpload
              onUpload={handleUpload}
              isUploading={uploadAttachment.isPending}
              label="Upload"
              variant="outline"
              icon
            />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        <AttachmentList
          attachments={attachmentsQuery.data ?? []}
          isLoading={attachmentsQuery.isLoading}
          isError={attachmentsQuery.isError}
          onRetry={() => attachmentsQuery.refetch()}
          onDelete={handleDelete}
          deletingAttachmentId={deletingAttachmentId}
          emptyAction={
            <AttachmentUpload onUpload={handleUpload} isUploading={uploadAttachment.isPending} />
          }
          className="max-h-64 overflow-y-auto"
        />
      </CardContent>
    </Card>
  );
}
