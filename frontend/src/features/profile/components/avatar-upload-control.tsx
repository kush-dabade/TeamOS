import { useRef } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ux";
import { useAuth } from "@/features/auth";

import { useDeleteAvatar } from "../hooks/use-delete-avatar";
import { useUploadAvatar } from "../hooks/use-upload-avatar";
import { ALLOWED_AVATAR_MIME_TYPES, AVATAR_MAX_FILE_SIZE } from "../lib/avatar-config";
import { getAvatarUrl } from "../lib/get-avatar-url";

interface AvatarUploadControlProps {
  name: string;
  image?: string | null;
  updatedAt: Date | string;
}

function validateAvatarFile(file: File): string | null {
  if (
    !ALLOWED_AVATAR_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_AVATAR_MIME_TYPES)[number],
    )
  ) {
    return "Please choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return "Image must be 5MB or smaller.";
  }

  return null;
}

// Same hidden-input-triggered-by-button shape as AttachmentUpload, adapted
// for a single persistent avatar (Change/Remove) instead of a growing list.
export function AvatarUploadControl({ name, image, updatedAt }: AvatarUploadControlProps) {
  const { refetch } = useAuth();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasAvatar = Boolean(image);
  const avatarUrl = getAvatarUrl({ image, updatedAt });

  const isUploading = uploadAvatar.isPending;
  const isDeleting = deleteAvatar.isPending;
  const isPending = isUploading || isDeleting;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Reset so selecting the same file again still fires onChange.
    event.target.value = "";

    if (!file) {
      return;
    }

    const validationError = validateAvatarFile(file);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await uploadAvatar.mutateAsync(file);
      await refetch();

      toast.success("Avatar updated successfully!");
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
      // The previous avatar is untouched since session state was never
      // optimistically changed.
    }
  }

  async function handleRemove() {
    try {
      await deleteAvatar.mutateAsync();
      await refetch();

      toast.success("Avatar removed successfully!");
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} image={avatarUrl} size="lg" />

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isPending}
          aria-label={hasAvatar ? "Change photo" : "Upload photo"}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Uploading..." : hasAvatar ? "Change photo" : "Upload photo"}
        </Button>

        {hasAvatar ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleRemove}
          >
            {isDeleting ? "Removing..." : "Remove photo"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
