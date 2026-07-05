import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../hooks/use-auth";

export function GuestRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === "pending") {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
