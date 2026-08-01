import type { Location } from "react-router-dom";

const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard";

// `AuthenticatedRoute` (and any page that wants to send a guest through
// login/register first) stashes the intended destination as
// `state.from.pathname`. Both LoginForm and RegisterForm read it back here
// so a successful sign-in/sign-up returns the user to where they meant to
// go instead of always landing on the dashboard.
export function getPostAuthRedirect(location: Location): string {
  return (
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    DEFAULT_AUTHENTICATED_ROUTE
  );
}
