import { Loader2 } from "lucide-react";

export function DemoProvisioningLoader() {
  return (
    <div role="status" className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />

      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold tracking-tight">Preparing your workspace</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Creating a private, temporary TeamOS workspace just for you…
        </p>
      </div>
    </div>
  );
}
