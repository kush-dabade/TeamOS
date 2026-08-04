import type { PropsWithChildren } from "react";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth";
import { RealtimeProvider } from "@/features/realtime";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return <Toaster theme={resolvedTheme} richColors position="top-right" />;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <RealtimeProvider>
            {children}
            <ThemedToaster />
          </RealtimeProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
