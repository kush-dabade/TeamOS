import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/features/auth";

import { useDemoStatus } from "./use-demo-status";

vi.mock("@/features/auth");

const mockUseAuth = vi.mocked(useAuth);

type AuthState = ReturnType<typeof useAuth>;

function authState(overrides: Partial<AuthState>): AuthState {
  return {
    user: null,
    status: "unauthenticated",
    isAuthenticated: false,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("useDemoStatus", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("reports not-demo when there is no user", () => {
    mockUseAuth.mockReturnValue(authState({ user: null }));

    const { result } = renderHook(() => useDemoStatus());

    expect(result.current).toEqual({ isDemo: false, expiresAt: null });
  });

  it("reports not-demo for a normal user (isDemo: false)", () => {
    mockUseAuth.mockReturnValue(
      authState({
        user: { id: "u1", name: "Real User", email: "real@example.com", isDemo: false } as never,
      }),
    );

    const { result } = renderHook(() => useDemoStatus());

    expect(result.current).toEqual({ isDemo: false, expiresAt: null });
  });

  it("reports demo status and parses demoExpiresAt into a Date for a demo user", () => {
    mockUseAuth.mockReturnValue(
      authState({
        user: {
          id: "u2",
          name: "Guest",
          email: "demo-abc@teamos.local",
          isDemo: true,
          demoExpiresAt: "2026-09-01T00:00:00.000Z",
        } as never,
      }),
    );

    const { result } = renderHook(() => useDemoStatus());

    expect(result.current.isDemo).toBe(true);
    expect(result.current.expiresAt).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  });
});
