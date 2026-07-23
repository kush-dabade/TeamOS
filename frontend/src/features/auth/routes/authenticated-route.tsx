import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageError } from "@/components/full-page-error";
import { FullPageLoader } from "@/components/full-page-loader";

import { useAuth } from "../hooks/use-auth";

export function AuthenticatedRoute() {
  const { status, isAuthenticated, refetch } = useAuth();
  const location = useLocation();

  if (status === "pending") {
    return <FullPageLoader />;
  }

  if (status === "error") {
    return (
      <FullPageError
        title="Couldn't verify your session"
        description="We couldn't reach the server. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}