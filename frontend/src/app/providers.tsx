import type { PropsWithChildren } from "react";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth";
import { QueryProvider } from "@/providers/query-provider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryProvider>
  );
}
