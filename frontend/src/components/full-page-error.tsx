import { WifiOff, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ux";

interface FullPageErrorProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  onRetry: () => void;
}

export function FullPageError({
  icon = WifiOff,
  title = "Connection problem",
  description = "We couldn't reach the server. Check your connection and try again.",
  onRetry,
}: FullPageErrorProps) {
  return (
    <div
      role="alert"
      className="flex h-screen w-screen items-center justify-center bg-background px-5"
    >
      <ErrorState
        icon={icon}
        title={title}
        description={description}
        action={
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    </div>
  );
}
