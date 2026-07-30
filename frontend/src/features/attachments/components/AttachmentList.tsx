import { Paperclip } from "lucide-react";

import { Button, Skeleton } from "@/components/ui";
import { EmptyState } from "@/components/ux";

import { AttachmentItem } from "./AttachmentItem";
import type { Attachment } from "../types";

interface AttachmentListProps {
  attachments: Attachment[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDelete: (attachmentId: string) => void;
}

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

// State-branching (error/loading/empty/populated), mirroring
// CommentList/NotificationList in the comments and notifications features.
export function AttachmentList({
  attachments,
  isLoading,
  isError,
  onRetry,
  onDelete,
}: AttachmentListProps) {
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load attachments</p>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading attachments.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="py-6">
        <EmptyState
          icon={Paperclip}
          title="No attachments yet."
          description="Files added to this task will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          onDelete={() => onDelete(attachment.id)}
        />
      ))}
    </div>
  );
}
