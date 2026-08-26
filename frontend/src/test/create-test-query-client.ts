import { QueryClient } from "@tanstack/react-query";

/**
 * A fresh QueryClient for hook tests. Retries are disabled so a rejected
 * mutation surfaces immediately instead of retrying against the mocked API,
 * and gcTime is zeroed so no cached state lingers between tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
