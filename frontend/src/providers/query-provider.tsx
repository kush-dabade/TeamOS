import { QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren } from "react";

import { queryClient } from "@/lib";

export function QueryProvider({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
