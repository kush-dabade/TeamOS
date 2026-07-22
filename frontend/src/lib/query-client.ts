import { QueryClient } from "@tanstack/react-query";

import { isAppError, type AppError } from "./api";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

const NON_RETRYABLE_ERROR_TYPES: AppError["type"][] = [
  "unauthorized",
  "forbidden",
  "not_found",
  "validation",
];

function isRetryableError(error: unknown): boolean {
  if (!isAppError(error)) {
    return true;
  }

  return !NON_RETRYABLE_ERROR_TYPES.includes(error.type);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * SECOND,
      gcTime: 5 * MINUTE,
      retry: (failureCount, error) => failureCount < 1 && isRetryableError(error),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
