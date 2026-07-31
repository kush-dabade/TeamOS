import { useRef } from "react";
import type { ChangeEvent } from "react";
import type { VariantProps } from "class-variance-authority";
import { Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui";

interface AttachmentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  label?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  icon?: boolean;
}

// Hidden native file input triggered by a shadcn Button, per the "keep it
// simple" upload UX requirement - no drag & drop, no progress bar, no
// multi-file batching (the backend accepts a single `file` field per
// request). Rendered by AttachmentsPanel in exactly one of two places at a
// time - compact/outline in the header once attachments exist, or as the
// empty state's bold primary action - so `label`/`variant`/`icon` let each
// context read appropriately without ever showing two upload CTAs at once.
export function AttachmentUpload({
  onUpload,
  isUploading,
  label = "Upload file",
  variant = "default",
  icon = false,
}: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Reset so selecting the same file again still fires onChange.
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      await onUpload(file);
    } catch {
      // Surfaced to the user via the upload mutation's onError toast.
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        disabled={isUploading}
        aria-label="Upload attachment"
      />
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {icon ? <Upload /> : null}
        {isUploading ? "Uploading..." : label}
      </Button>
    </div>
  );
}
