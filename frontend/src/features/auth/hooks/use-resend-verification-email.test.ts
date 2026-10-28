import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { resendVerificationEmail } from "../api/auth.api";
import { useResendVerificationEmail } from "./use-resend-verification-email";

vi.mock("../api/auth.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockResend = vi.mocked(resendVerificationEmail);

function createWrapper() {
  const queryClient = createTestQueryClient();

  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useResendVerificationEmail", () => {
  beforeEach(() => {
    mockResend.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("reports the email as requested rather than delivered", async () => {
    mockResend.mockResolvedValue(undefined);

    const { result } = renderHook(() => useResendVerificationEmail(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("ada@example.com");

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    const message = vi.mocked(toast.success).mock.calls[0]?.[0];
    expect(message).toMatch(/requested/i);
    expect(message).not.toMatch(/\bsent\b/i);
  });

  it("surfaces the server error instead of a success toast", async () => {
    mockResend.mockRejectedValue({ type: "rate_limit", message: "Too many requests" });

    const { result } = renderHook(() => useResendVerificationEmail(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("ada@example.com");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Too many requests");
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
