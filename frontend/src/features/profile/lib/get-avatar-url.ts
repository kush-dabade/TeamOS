import { env } from "@/lib/env";

interface AvatarUrlUser {
  image?: string | null;
  updatedAt: Date | string;
}

// The session's `image` field is an internal storage reference, not a
// browsable URL - the actual bytes only exist behind the authenticated
// GET /users/me/avatar endpoint. The `updatedAt` timestamp changes on every
// avatar upload/removal, so using it as a query param busts the browser's
// image cache without any extra client-side state.
export function getAvatarUrl(user: AvatarUrlUser): string | null {
  if (!user.image) {
    return null;
  }

  const version = new Date(user.updatedAt).getTime();

  return `${env.apiUrl}/api/v1/users/me/avatar?v=${version}`;
}
