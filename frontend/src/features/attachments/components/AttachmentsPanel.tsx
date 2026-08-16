import { useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui";

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

  // A Set, not a single id - deletes on different attachments can legitimately
  // overlap (nothing blocks starting a second row's delete while an earlier
  // one is still in flight), so a single shared id would have one delete's
  // completion clear another still-pending delete's own indicator.
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<Set<string>>(new Set());

  const handleUpload = async (file: File) => {
    await uploadAttachment.mutateAsync({ taskId, file });
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingAttachmentIds((prev) => new Set(prev).add(attachmentId));

    try {
      await deleteAttachment.mutateAsync({ attachmentId, taskId });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    } finally {
      setDeletingAttachmentIds((prev) => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
    }
  };

  return (
    <Card size="sm">
      <CardHeader>
        <h3 className="text-sm font-medium">Attachments</h3>
      </CardHeader>

      <CardContent className="flex-1 min-h-64">
        <AttachmentList
          attachments={attachmentsQuery.data ?? []}
          isLoading={attachmentsQuery.isLoading}
          isError={attachmentsQuery.isError}
          onRetry={() => attachmentsQuery.refetch()}
          onDelete={handleDelete}
          deletingAttachmentIds={deletingAttachmentIds}
          className="h-full overflow-y-auto"
        />
      </CardContent>

      <CardContent className="mt-auto">
        <AttachmentUpload onUpload={handleUpload} isUploading={uploadAttachment.isPending} />
      </CardContent>
    </Card>
  );
}
