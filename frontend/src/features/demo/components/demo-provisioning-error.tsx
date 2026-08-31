import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ux";

interface DemoProvisioningErrorProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function DemoProvisioningError({ onRetry, isRetrying }: DemoProvisioningErrorProps) {
  return (
    <ErrorState
      icon={AlertTriangle}
      title="Something went wrong"
      description="We couldn't prepare your demo workspace. Please try again."
      action={
        <>
          <Button type="button" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? "Trying again…" : "Try again"}
          </Button>

          <Button type="button" variant="outline" asChild>
            <Link to="/">Back to TeamOS</Link>
          </Button>
        </>
      }
    />
  );
}
