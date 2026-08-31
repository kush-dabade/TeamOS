import { useMutation } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { createDemoSession, type DemoSession } from "../api/demo.api";

// A provisioning action, not cacheable query data - modeled as a mutation
// (queryClient's global mutations.retry: false, lib/query-client.ts,
// already prevents an accidental silent second attempt). No onSuccess/
// onError here: TryPage owns what happens next (refetching the auth
// session, navigating, rendering the error state) since that orchestration
// is specific to this one page, not something other callers would share.
export function useCreateDemoSession() {
  return useMutation<DemoSession, AppError, void>({
    mutationFn: createDemoSession,
  });
}
