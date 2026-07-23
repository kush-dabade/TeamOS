import { Loader2 } from "lucide-react";

export function FullPageLoader() {
  return (
    <div
      role="status"
      className="flex h-screen w-screen items-center justify-center bg-background"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
