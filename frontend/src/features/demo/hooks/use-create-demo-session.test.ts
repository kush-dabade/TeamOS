import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppError } from "@/lib/api";
import { createTestQueryClient } from "@/test/create-test-query-client";

import { createDemoSession } from "../api/demo.api";
import { useCreateDemoSession } from "./use-create-demo-session";

vi.mock("../api/demo.api");

const mockCreateDemoSession = vi.mocked(createDemoSession);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useCreateDemoSession", () => {
  beforeEach(() => {
    mockCreateDemoSession.mockReset();
  });

  it("calls the demo session API with no arguments and resolves with the expiration it returns", async () => {
    mockCreateDemoSession.mockResolvedValue({ expiresAt: "2026-09-01T00:00:00.000Z" });

    const { result } = renderHook(() => useCreateDemoSession(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await expect(result.current.mutateAsync()).resolves.toEqual({
      expiresAt: "2026-09-01T00:00:00.000Z",
    });

    expect(mockCreateDemoSession).toHaveBeenCalledTimes(1);
  });

  it("surfaces the AppError when provisioning fails", async () => {
    const mockError: AppError = { type: "server", message: "Failed to provision demo session" };
    mockCreateDemoSession.mockRejectedValue(mockError);

    const { result } = renderHook(() => useCreateDemoSession(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await expect(result.current.mutateAsync()).rejects.toEqual(mockError);
  });
});
