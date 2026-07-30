import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { UserAvatar } from "@/components/ux";
import { cn } from "@/utils";

import { CommentForm } from "./CommentForm";
import { formatCompactTime } from "../lib/format-compact-time";
import type { Comment } from "../types";

// How long the collapse animation plays before the delete mutation actually
// fires - keeps the row visible just long enough for the height/opacity
// transition below to be perceptible instead of the row just vanishing.
const DELETE_COLLAPSE_MS = 180;

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
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = () => {
    setIsDeleteDialogOpen(false);
    setIsDeleting(true);
    window.setTimeout(onDelete, DELETE_COLLAPSE_MS);
  };

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        isDeleting ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "group/comment relative flex items-start gap-2.5 rounded-md bg-muted/25 px-3 py-2.5",
            !isEditing && "animate-in fade-in duration-200",
          )}
        >
          <UserAvatar
            name={comment.author.name}
            image={comment.author.image}
            size="sm"
            shape="square"
          />

          <div className="min-w-0 flex-1 pr-7">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-medium">{comment.author.name}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <time className="text-xs text-muted-foreground">
                {formatCompactTime(comment.createdAt)}
              </time>
            </div>

            {isEditing ? (
              <div className="mt-2">
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
              <p className="mt-1.5 text-sm leading-5 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}
          </div>

          {isOwn && !isEditing ? (
            <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity duration-200 group-hover/comment:opacity-100 group-focus-within/comment:opacity-100 data-[state=open]:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${comment.author.name}'s comment`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onStartEdit}>Edit</DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => {
                      event.preventDefault();
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove your comment from the task.
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
        </div>
      </div>
    </div>
  );
}
