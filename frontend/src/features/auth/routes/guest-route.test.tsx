import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROTECTED_CONTENT_TEXT, renderGuard } from "@/test/render-guard";

import { useAuth } from "../hooks/use-auth";
import { GuestRoute } from "./guest-route";

vi.mock("../hooks/use-auth");

const mockUseAuth = vi.mocked(useAuth);

type AuthState = ReturnType<typeof useAuth>;

function authState(overrides: Partial<AuthState>): AuthState {
  return {
    user: null,
    status: "pending",
    isAuthenticated: false,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("GuestRoute", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("renders a loading state while the session is pending", () => {
    mockUseAuth.mockReturnValue(authState({ status: "pending", isPending: true }));

    renderGuard(<GuestRoute />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects to /dashboard without preserving the current location when already authenticated", () => {
    mockUseAuth.mockReturnValue(authState({ status: "authenticated", isAuthenticated: true }));

    renderGuard(<GuestRoute />);

    const probe = screen.getByTestId("route-probe");

    expect(probe.dataset.pathname).toBe("/dashboard");
    expect(probe.dataset.from).toBe("");
  });

  it("renders the guest content when unauthenticated, and still falls through to it when the session query errors (no explicit error branch - intentional, not a bug)", () => {
    mockUseAuth.mockReturnValue(authState({ status: "unauthenticated", isAuthenticated: false }));

    renderGuard(<GuestRoute />);

    expect(screen.getByText(PROTECTED_CONTENT_TEXT)).toBeInTheDocument();

    mockUseAuth.mockReturnValue(authState({ status: "error", isAuthenticated: false }));

    renderGuard(<GuestRoute />);

    expect(screen.getByText(PROTECTED_CONTENT_TEXT)).toBeInTheDocument();
  });
});
