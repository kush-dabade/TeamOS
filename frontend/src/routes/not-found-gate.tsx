import { Navigate } from "react-router-dom";

import { useAuth } from "@/features/auth";
import NotFoundPage from "@/pages/NotFoundPage";

export function NotFoundGate() {
  const { status, isAuthenticated } = useAuth();

  if (status === "pending") {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/not-found" replace />;
  }

  return <NotFoundPage />;
}
