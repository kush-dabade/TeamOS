import type { ReactNode } from "react";
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
  emptyAction?: ReactNode;
  className?: string;
}

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

// State-branching (error/loading/empty/populated), mirroring
// CommentList/NotificationList in the comments and notifications features.
// Unlike those lists, rows are separated by hairline dividers rather than
// stacked gaps - attachments are a scannable file list, not conversation
// entries, so the density reads closer to a table than a feed.
export function AttachmentList({
  attachments,
  isLoading,
  isError,
  onRetry,
  onDelete,
  deletingAttachmentIds,
  emptyAction,
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
      <div className="divide-y divide-border/50">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="size-9 shrink-0 rounded-md" />
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
      <div className="flex min-h-48 items-center justify-center">
        <EmptyState
          icon={Paperclip}
          title="No attachments yet"
          description="Files added to this task will appear here."
          action={emptyAction}
          iconClassName="size-12"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "divide-y divide-border/50 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent",
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
