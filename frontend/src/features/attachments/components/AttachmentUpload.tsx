import { useRef } from "react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui";

interface AttachmentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

// Hidden native file input triggered by a shadcn Button, per the "keep it
// simple" upload UX requirement - no drag & drop, no progress bar, no
// multi-file batching (the backend accepts a single `file` field per
// request).
export function AttachmentUpload({ onUpload, isUploading }: AttachmentUploadProps) {
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
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? "Uploading..." : "Upload file"}
      </Button>
    </div>
  );
}
