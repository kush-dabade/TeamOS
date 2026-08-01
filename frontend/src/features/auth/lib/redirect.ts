import type { Location } from "react-router-dom";

const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard";

// `AuthenticatedRoute` (and any page that wants to send a guest through
// login/register first) stashes the intended destination as `state.from`,
// the full router `Location`. Both LoginForm and RegisterForm read it back
// here so a successful sign-in/sign-up returns the user to where they meant
// to go (including any query/hash) instead of always landing on the dashboard.
export function getPostAuthRedirect(location: Location): string {
  const from = (location.state as { from?: Partial<Location> } | null)?.from;

  if (!from?.pathname) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }

  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}
