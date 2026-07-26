import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Link, useRouteError } from "react-router-dom";

import { ErrorState, PageError } from "@/components/ux";
import { Button } from "@/components/ui/button";

export default function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageError>
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
    </PageError>
  );
}
