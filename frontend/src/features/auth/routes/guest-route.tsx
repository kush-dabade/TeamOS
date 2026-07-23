import { Navigate, Outlet } from "react-router-dom";

import { FullPageLoader } from "@/components/full-page-loader";

import { useAuth } from "../hooks/use-auth";

export function GuestRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === "pending") {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
