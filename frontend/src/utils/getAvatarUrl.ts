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
//
// Deployment assumption: this URL is loaded via a plain <img src>, so the
// browser must attach the Better Auth session cookie (SameSite=Lax, the
// library default - unchanged here) itself. That only happens automatically
// when the frontend and backend are same-site (e.g. subdomains of one
// parent domain, or different localhost ports, as in local dev) - the same
// requirement every other authenticated request in this app already has via
// Better Auth's own cookie. If TeamOS is ever deployed with the frontend and
// backend on genuinely unrelated domains, this (and the rest of the
// cookie-based session) will need revisiting (e.g. SameSite=None + explicit
// crossOrigin/CORS handling) - that is a deliberate deployment decision, not
// something to infer here.
export function getAvatarUrl(user: AvatarUrlUser): string | null {
  if (!user.image) {
    return null;
  }

  const version = new Date(user.updatedAt).getTime();

  return `${env.apiUrl}/api/v1/users/me/avatar?v=${version}`;
}
