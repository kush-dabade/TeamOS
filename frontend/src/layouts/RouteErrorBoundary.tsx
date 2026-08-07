import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Link, useRouteError } from "react-router-dom";

import { ErrorState, PageError } from "@/components/ux";
import { Button } from "@/components/ui/button";

interface RouteErrorBoundaryProps {
  // Set for boundaries that render outside any sized layout (e.g. above
  // AppShell, or on the public/guest tree) - mirrors NotFoundPage/
  // FullPageError's full-viewport wrapper. Left false (PageError) for
  // boundaries that render inside AppShell's already-sized content slot.
  fullPage?: boolean;
  // Defaults suit the authenticated tree, where "/dashboard" is always a
  // valid destination. Public/guest usages (Home, Invitation, GuestRoute)
  // override both, since /dashboard would just bounce a logged-out visitor
  // to /login instead of doing what the button claims.
  recoveryPath?: string;
  recoveryLabel?: string;
}

export default function RouteErrorBoundary({
  fullPage = false,
  recoveryPath = "/dashboard",
  recoveryLabel = "Back to dashboard",
}: RouteErrorBoundaryProps) {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const content = (
    <ErrorState
      icon={TriangleAlert}
      title="Something went wrong"
      description="This page ran into an unexpected error. Try reloading, or use the button below to get back on track."
      action={
        <>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>

          <Button asChild>
            <Link to={recoveryPath}>{recoveryLabel}</Link>
          </Button>
        </>
      }
    />
  );

  if (fullPage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-5">
        {content}
      </div>
    );
  }

  return <PageError>{content}</PageError>;
}
