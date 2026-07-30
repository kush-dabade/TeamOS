import { Paperclip } from "lucide-react";

import { Skeleton } from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";
import { cn } from "@/utils";

import { AttachmentItem } from "./AttachmentItem";
import type { Attachment } from "../types";

interface AttachmentListProps {
  attachments: Attachment[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDelete: (attachmentId: string) => void;
  className?: string;
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
  className,
}: AttachmentListProps) {
  if (isError) {
    return (
      <ListErrorState
        title="Couldn't load attachments"
        description="Something went wrong while loading attachments."
        onRetry={onRetry}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-start gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
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
      <EmptyState
        icon={Paperclip}
        title="No attachments yet"
        description="Files added to this task will appear here."
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
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
