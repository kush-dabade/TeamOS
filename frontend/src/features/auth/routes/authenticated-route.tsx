import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/use-auth";

export function AuthenticatedRoute() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === "pending") {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}