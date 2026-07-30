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

  const handleUpload = async (file: File) => {
    await uploadAttachment.mutateAsync({ taskId, file });
  };

  const handleDelete = (attachmentId: string) => {
    deleteAttachment.mutate({ attachmentId, taskId });
  };

  return (
    <Card size="sm">
      <CardHeader>
        <h3 className="text-sm font-medium">Attachments</h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AttachmentList
          attachments={attachmentsQuery.data ?? []}
          isLoading={attachmentsQuery.isLoading}
          isError={attachmentsQuery.isError}
          onRetry={() => attachmentsQuery.refetch()}
          onDelete={handleDelete}
        />

        <AttachmentUpload onUpload={handleUpload} isUploading={uploadAttachment.isPending} />
      </CardContent>
    </Card>
  );
}
