import { Navigate, Outlet } from "react-router-dom";

import { FullPageError } from "@/components/full-page-error";
import { FullPageLoader } from "@/components/full-page-loader";

import { useCurrentWorkspace } from "../hooks/use-current-workspace";

export function WorkspaceGuard() {
  const { data: workspace, isPending, isError, refetch } = useCurrentWorkspace();

  if (isPending) {
    return <FullPageLoader />;
  }

  if (isError) {
    return (
      <FullPageError
        title="Couldn't load your workspace"
        description="We couldn't reach the server. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!workspace) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
