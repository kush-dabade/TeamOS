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
  deletingAttachmentIds: Set<string>;
  className?: string;
}

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

// State-branching (error/loading/empty/populated), mirroring
// CommentList/NotificationList in the comments and notifications features.
// Rows are shadcn Attachment chips (own border/rounded surface per row), so
// they're stacked with gaps rather than hairline dividers - a divider line
// would double up against each chip's own border instead of complementing it.
export function AttachmentList({
  attachments,
  isLoading,
  isError,
  onRetry,
  onDelete,
  deletingAttachmentIds,
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
      <div className="flex flex-col gap-2">
        {skeletonRows.map((row) => (
          <div
            key={row}
            className="flex items-center gap-2.5 rounded-xl border bg-card px-2 py-1.5"
          >
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={Paperclip}
          title="No attachments yet"
          description="Files added to this task will appear here."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent",
        className,
      )}
    >
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          onDelete={() => onDelete(attachment.id)}
          isDeleting={deletingAttachmentIds.has(attachment.id)}
        />
      ))}
    </div>
  );
}
