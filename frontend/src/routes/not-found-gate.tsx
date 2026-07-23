import { Navigate } from "react-router-dom";

import { FullPageLoader } from "@/components/full-page-loader";
import { useAuth } from "@/features/auth";
import NotFoundPage from "@/pages/NotFoundPage";

export function NotFoundGate() {
  const { status, isAuthenticated } = useAuth();

  if (status === "pending") {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/not-found" replace />;
  }

  return <NotFoundPage />;
}
