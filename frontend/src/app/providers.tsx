import { Toaster } from "sonner";
import type { PropsWithChildren } from "react";

import { QueryProvider } from "@/providers/query-provider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      {children}
      <Toaster richColors position="top-right" />
    </QueryProvider>
  );
}
