import { Navigate, Outlet } from "react-router-dom";

import { FullPageError } from "@/components/full-page-error";
import { FullPageLoader } from "@/components/full-page-loader";

import { useWorkspaceResolution } from "../hooks/use-workspace-resolution";

/**
 * Sole owner of workspace loading/error/onboarding-redirect. Reads
 * useWorkspaceResolution (not the narrowed useActiveWorkspace) because it's
 * the one place in the app allowed to know workspaces are still resolving.
 */
export function WorkspaceGuard() {
  const { workspaces, isLoading, isError, refetch } = useWorkspaceResolution();

  if (isLoading) {
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

  if (workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
