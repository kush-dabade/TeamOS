import { MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";
import { cn } from "@/utils";

import { CommentItem } from "./CommentItem";
import type { Comment } from "../types";

interface CommentListProps {
  comments: Comment[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  currentUserId: string | undefined;
  editingCommentId: string | null;
  onStartEdit: (commentId: string) => void;
  onCancelEdit: () => void;
  onEditSubmit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  className?: string;
}

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

// State-branching (error/loading/empty/populated) for the comment thread.
// Structurally similar to Activity's ActivityFeed, but kept separate rather
// than generalized: comment rows are interactive (edit/delete/own-comment
// checks) where activity rows are read-only, and this commit's scope
// excludes touching the Activity feature to make room for a shared version.
export function CommentList({
  comments,
  isLoading,
  isError,
  onRetry,
  currentUserId,
  editingCommentId,
  onStartEdit,
  onCancelEdit,
  onEditSubmit,
  onDelete,
  className,
}: CommentListProps) {
  if (isError) {
    return (
      <ListErrorState
        title="Couldn't load comments"
        description="Something went wrong while loading comments."
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
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No comments yet"
        description="Be the first to comment on this task."
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          isOwn={Boolean(currentUserId) && comment.author.id === currentUserId}
          isEditing={editingCommentId === comment.id}
          onStartEdit={() => onStartEdit(comment.id)}
          onCancelEdit={onCancelEdit}
          onEditSubmit={(content) => onEditSubmit(comment.id, content)}
          onDelete={() => onDelete(comment.id)}
        />
      ))}
    </div>
  );
}
