import { useState } from "react";
import { Download, Trash2 } from "lucide-react";

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
import { formatFileSize, formatRelativeDate } from "@/utils";

import { ATTACHMENT_ICONS, DEFAULT_ATTACHMENT_ICON } from "../lib/attachment-icon";
import { getAttachmentDownloadUrl } from "../lib/attachment-url";
import type { Attachment } from "../types";

interface AttachmentItemProps {
  attachment: Attachment;
  onDelete: () => void;
}

// Presentational building block for a single attachment row. Any workspace
// member (not just the uploader) can delete an attachment - the backend
// enforces membership/guest restrictions, so this never gates on ownership.
export function AttachmentItem({ attachment, onDelete }: AttachmentItemProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const Icon = ATTACHMENT_ICONS[attachment.mimeType] ?? DEFAULT_ATTACHMENT_ICON;

  const handleConfirmDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.originalName}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{formatFileSize(attachment.size)}</span>
          <span aria-hidden="true">&middot;</span>
          <time>{formatRelativeDate(attachment.createdAt)}</time>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Download ${attachment.originalName}`}
        >
          <a href={getAttachmentDownloadUrl(attachment.id)} download={attachment.originalName}>
            <Download />
          </a>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Delete ${attachment.originalName}`}
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
        </Button>

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
