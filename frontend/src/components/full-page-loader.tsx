import { Loader2 } from "lucide-react";

export function FullPageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
