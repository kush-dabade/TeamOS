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
}

export default function RouteErrorBoundary({ fullPage = false }: RouteErrorBoundaryProps) {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const content = (
    <ErrorState
      icon={TriangleAlert}
      title="Something went wrong"
      description="This page ran into an unexpected error. Try reloading, or head back to your dashboard."
      action={
        <>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>

          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
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
