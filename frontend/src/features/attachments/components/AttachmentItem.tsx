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
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { formatFileSize, formatRelativeDate } from "@/utils";

import { ATTACHMENT_FILE_TYPES, DEFAULT_ATTACHMENT_FILE_TYPE } from "../lib/attachment-file-type";
import { getAttachmentDownloadUrl } from "../lib/attachment-url";
import type { Attachment as AttachmentRecord } from "../types";

interface AttachmentItemProps {
  attachment: AttachmentRecord;
  onDelete: () => void;
  isDeleting: boolean;
}

// Presentational building block for a single attachment row, built on the
// shadcn Attachment primitive (registry:ui, @/components/ui/attachment).
// Any workspace member (not just the uploader) can delete an attachment -
// the backend enforces membership/guest restrictions, so this never gates
// on ownership.
export function AttachmentItem({ attachment, onDelete, isDeleting }: AttachmentItemProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { icon: Icon, label } = ATTACHMENT_FILE_TYPES[attachment.mimeType] ?? DEFAULT_ATTACHMENT_FILE_TYPE;

  const handleConfirmDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <Attachment size="sm" className="w-full" title={formatRelativeDate(attachment.createdAt)}>
      <AttachmentMedia>
        <Icon aria-hidden="true" />
      </AttachmentMedia>

      <AttachmentContent>
        <AttachmentTitle>{attachment.originalName}</AttachmentTitle>
        <AttachmentDescription>
          {label} &middot; {formatFileSize(attachment.size)}
        </AttachmentDescription>
      </AttachmentContent>

      {/* Uses AttachmentActions' own default treatment (always-visible flex
          sibling, per the official example) instead of a hover-reveal
          overlay - the row's own has-[>a,>button]:hover:bg-muted/50 (baked
          into Attachment's base styles) already supplies hover feedback. */}
      <AttachmentActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AttachmentAction
              aria-label={`Actions for ${attachment.originalName}`}
              disabled={isDeleting}
            >
              <MoreHorizontal />
            </AttachmentAction>
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
      </AttachmentActions>
    </Attachment>
  );
}
