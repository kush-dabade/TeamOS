import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { FullPageLoader } from "@/components/full-page-loader";

import { useAuth } from "../hooks/use-auth";

export function GuestRoute() {
  const { status, isAuthenticated } = useAuth();

  // Better Auth's session goes back to "pending" on every refetch while
  // there is no session (isPending = data === null), and sign-up, sign-in
  // attempts and verification resends all trigger one. Swapping the page
  // for the loader then unmounted the guest form and threw away its state -
  // the "check your email" confirmation after registering, and the
  // "email not verified" panel after a sign-in attempt. So the loader only
  // covers the first session check; afterwards the page stays mounted and
  // the redirect below still applies once a session appears. (Tracked in
  // render, like WorkspaceProvider's reconciliation, not in an effect.)
  const [hasResolvedSession, setHasResolvedSession] = useState(status !== "pending");

  if (status !== "pending" && !hasResolvedSession) {
    setHasResolvedSession(true);
  }

  if (status === "pending" && !hasResolvedSession) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
