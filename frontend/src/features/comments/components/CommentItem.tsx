import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/ui";
import { UserAvatar } from "@/components/ux";
import { formatRelativeDate } from "@/utils";

import { CommentForm } from "./CommentForm";
import type { Comment } from "../types";

interface CommentItemProps {
  comment: Comment;
  isOwn: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditSubmit: (content: string) => Promise<void>;
  onDelete: () => void;
}

// Presentational building block for a single comment. Owns only the
// view/edit toggle for its own content and the delete-confirmation dialog's
// open state - list membership, mutation calls, and "who am I" all live in
// CommentsPanel.
export function CommentItem({
  comment,
  isOwn,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onEditSubmit,
  onDelete,
}: CommentItemProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleConfirmDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="flex items-start gap-3">
      <UserAvatar name={comment.author.name} image={comment.author.image} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.author.name}</span>
          <time className="text-xs text-muted-foreground">
            {formatRelativeDate(comment.createdAt)}
          </time>
        </div>

        {isEditing ? (
          <div className="mt-1.5">
            <CommentForm
              mode="edit"
              initialValue={comment.content}
              placeholder="Edit your comment..."
              submitLabel="Save"
              onSubmit={onEditSubmit}
              onCancel={onCancelEdit}
            />
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-sm leading-5 whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {isOwn ? (
              <div className="mt-1 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Edit comment"
                  onClick={onStartEdit}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete comment"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 />
                </Button>

                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your comment. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
