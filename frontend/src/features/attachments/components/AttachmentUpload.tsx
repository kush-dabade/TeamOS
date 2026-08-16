import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { cn } from "@/utils";

import { ATTACHMENT_FILE_TYPES } from "../lib/attachment-file-type";
import { ALLOWED_ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_FILE_SIZE } from "../lib/attachment-config";

interface AttachmentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

const acceptedTypesCaption = Object.values(ATTACHMENT_FILE_TYPES)
  .map((type) => type.label)
  .join(", ");
const maxSizeCaption = `${ATTACHMENT_MAX_FILE_SIZE / (1024 * 1024)}MB`;

function validateAttachmentFile(file: File): string | null {
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    return "File type not supported.";
  }

  if (file.size > ATTACHMENT_MAX_FILE_SIZE) {
    return `File must be ${maxSizeCaption} or smaller.`;
  }

  return null;
}

// Drag-and-drop dropzone, bottom-pinned as the single upload entry point in
// AttachmentsPanel. The backend accepts one file per request (see
// task-attachment.routes.ts's uploadSingleAttachment middleware), so a
// multi-file drop/selection is uploaded sequentially through the same
// single-file `onUpload` mutation rather than introducing a batch endpoint.
// Client-side validation (type/size) mirrors the backend's own so rejected
// files get instant feedback instead of a round trip - the backend still
// re-validates independently and remains authoritative.
export function AttachmentUpload({ onUpload, isUploading }: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const [isDragActive, setIsDragActive] = useState(false);
  // Count of files in the current batch, not just a boolean - lets the
  // trigger label say "Uploading 3 files..." instead of a generic spinner
  // label, and null (vs. 0) distinguishes "no batch running" from "batch of
  // zero" so it doubles cleanly as the busy flag.
  const [queuedCount, setQueuedCount] = useState<number | null>(null);

  const isBusy = isUploading || queuedCount !== null;

  async function processFiles(files: File[]) {
    const validFiles: File[] = [];

    for (const file of files) {
      const validationError = validateAttachmentFile(file);

      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      return;
    }

    setQueuedCount(validFiles.length);

    try {
      for (const file of validFiles) {
        try {
          await onUpload(file);
        } catch {
          // Surfaced via the upload mutation's onError toast; keep going
          // with the rest of the batch instead of aborting it.
        }
      }
    } finally {
      setQueuedCount(null);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    // Reset so selecting the same file(s) again still fires onChange.
    event.target.value = "";

    void processFiles(files);
  }

  function openPicker() {
    if (isBusy) {
      return;
    }

    inputRef.current?.click();
  }

  function hasFilesPayload(event: DragEvent<HTMLDivElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (isBusy || !hasFilesPayload(event)) {
      return;
    }

    dragCounterRef.current += 1;
    setIsDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Required for the element to be a valid drop target at all.
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (dragCounterRef.current === 0) {
      return;
    }

    // Counter (not a single boolean) - dragging over a child element fires
    // dragleave on the parent before dragenter on the child, so a naive
    // boolean would flicker the active state off between them.
    dragCounterRef.current -= 1;

    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    // Always prevent default, even while busy - otherwise the browser's
    // fallback action is to navigate to the dropped file.
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    if (isBusy) {
      return;
    }

    void processFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onClick={openPicker}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/30 px-3.5 py-3 text-center transition-colors",
        isDragActive && "border-primary bg-primary/5",
        isBusy && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Upload aria-hidden="true" className="size-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Drag &amp; drop or</p>

        {/* The zone's own onClick above is a mouse-only convenience covering
            the whole box; this button is the actual keyboard/screen-reader
            entry point (Enter/Space on it fires a native click that bubbles
            up to the zone's handler too). */}
        <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={openPicker}>
          {queuedCount ? `Uploading ${queuedCount} file${queuedCount > 1 ? "s" : ""}...` : "Upload files"}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(",")}
        onChange={handleChange}
        disabled={isBusy}
        aria-label="Upload attachment files"
      />

      <p className="text-xs text-muted-foreground">
        {acceptedTypesCaption} &middot; Max {maxSizeCaption}
      </p>

      <span role="status" aria-live="polite" className="sr-only">
        {isDragActive ? "Drop to upload" : ""}
      </span>
    </div>
  );
}
