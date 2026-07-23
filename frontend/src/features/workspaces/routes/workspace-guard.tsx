import { Navigate, Outlet } from "react-router-dom";

import { FullPageLoader } from "@/components/full-page-loader";

import { useCurrentWorkspace } from "../hooks/use-current-workspace";

export function WorkspaceGuard() {
  const { data: workspace, isPending } = useCurrentWorkspace();

  if (isPending) {
    return <FullPageLoader />;
  }

  if (!workspace) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
