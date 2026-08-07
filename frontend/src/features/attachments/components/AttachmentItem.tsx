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
import { formatFileSize, formatRelativeDate } from "@/utils";

import { ATTACHMENT_FILE_TYPES, DEFAULT_ATTACHMENT_FILE_TYPE } from "../lib/attachment-file-type";
import { getAttachmentDownloadUrl } from "../lib/attachment-url";
import type { Attachment } from "../types";

interface AttachmentItemProps {
  attachment: Attachment;
  onDelete: () => void;
  isDeleting: boolean;
}

// Presentational building block for a single attachment row. Any workspace
// member (not just the uploader) can delete an attachment - the backend
// enforces membership/guest restrictions, so this never gates on ownership.
export function AttachmentItem({ attachment, onDelete, isDeleting }: AttachmentItemProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { icon: Icon, label } = ATTACHMENT_FILE_TYPES[attachment.mimeType] ?? DEFAULT_ATTACHMENT_FILE_TYPE;

  const handleConfirmDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <div
      className="group/attachment relative flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted/40"
      title={formatRelativeDate(attachment.createdAt)}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1 pr-7">
        <p className="truncate text-sm font-medium">{attachment.originalName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {label} &middot; {formatFileSize(attachment.size)}
        </p>
      </div>

      <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover/attachment:opacity-100 group-focus-within/attachment:opacity-100 data-[state=open]:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for ${attachment.originalName}`}
              disabled={isDeleting}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={getAttachmentDownloadUrl(attachment.id)} download={attachment.originalName}>
                Download
              </a>
            </DropdownMenuItem>
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
              <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{attachment.originalName}&quot;. This action
                cannot be undone.
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
    </div>
  );
}
