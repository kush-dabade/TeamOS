import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ux";
import { useAuth } from "@/features/auth";
import { authClient } from "@/lib/auth-client";
import { getAvatarUrl } from "@/utils";

import { useDeleteAvatar } from "../hooks/use-delete-avatar";
import { useUploadAvatar } from "../hooks/use-upload-avatar";
import { ALLOWED_AVATAR_MIME_TYPES, AVATAR_MAX_FILE_SIZE } from "../lib/avatar-config";

interface AvatarUploadControlProps {
  name: string;
  image?: string | null;
  updatedAt: Date | string;
}

type PendingOperation = "upload" | "delete" | null;

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

  // Covers the full user-visible operation - the mutation itself *and* the
  // session refetch that follows it - not just the network request. The
  // mutations' own `isPending` flips false as soon as the request resolves,
  // before the avatar the user sees has actually updated; this stays true
  // until that's done too, so the controls can't be re-triggered in between.
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);

  const hasAvatar = Boolean(image);
  const avatarUrl = getAvatarUrl({ image, updatedAt });

  const isUploading = pendingOperation === "upload";
  const isDeleting = pendingOperation === "delete";
  const isPending = pendingOperation !== null;

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

    setPendingOperation("upload");

    try {
      await uploadAvatar.mutateAsync(file);
    } catch {
      // Mutation failed - already surfaced via the mutation's onError toast.
      // Nothing changed server-side, so there's nothing to resync.
      setPendingOperation(null);
      return;
    }

    // Mutation succeeded. Stay pending through the session resync too, so
    // the controls can't be re-triggered before the visible avatar catches
    // up with what the backend now has.
    await syncSessionAfterMutation("updated");
  }

  async function handleRemove() {
    setPendingOperation("delete");

    try {
      await deleteAvatar.mutateAsync();
    } catch {
      // Mutation failed - already surfaced via the mutation's onError toast.
      // Nothing changed server-side, so there's nothing to resync.
      setPendingOperation(null);
      return;
    }

    await syncSessionAfterMutation("removed");
  }

  // The mutation succeeding and the session refetch succeeding are two
  // different things: the backend can have genuinely applied the change
  // while our client fails to learn about it (a transient blip right after).
  // That's not a mutation failure - the mutation's onError never fires for
  // it - so it needs its own feedback instead of falling into the generic
  // error path or staying silent.
  //
  // useAuth()'s refetch() can't tell us which case we're in: Better Auth's
  // session hook swallows fetch failures internally (it always resolves,
  // storing any error in its own shared session state rather than rejecting
  // the caller's promise), so `await refetch()` never throws here even when
  // the request genuinely fails. authClient.$fetch is the same underlying,
  // publicly-exposed client used for every other Better Auth call in this
  // app (see profile.api.ts) and does surface `{ error }` directly, so it's
  // used here purely to detect success/failure for this toast; refetch()
  // is still called alongside it so the rest of the app (sidebar, etc.)
  // picks up the change through the normal reactive session state.
  async function syncSessionAfterMutation(verb: "updated" | "removed") {
    try {
      const [{ error }] = await Promise.all([
        authClient.$fetch("/get-session", { method: "GET" }),
        refetch(),
      ]);

      if (error) {
        toast.warning(
          `Avatar ${verb}, but we couldn't refresh your view. Refresh the page to see it.`,
        );
      } else {
        toast.success(`Avatar ${verb} successfully!`);
      }
    } catch {
      // Belt-and-braces: even if something above throws unexpectedly, don't
      // claim success and don't leave the user with no feedback at all.
      toast.warning(
        `Avatar ${verb}, but we couldn't refresh your view. Refresh the page to see it.`,
      );
    } finally {
      setPendingOperation(null);
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
