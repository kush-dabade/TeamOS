import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROTECTED_CONTENT_TEXT, renderGuard } from "@/test/render-guard";

import { useAuth } from "../hooks/use-auth";
import { AuthenticatedRoute } from "./authenticated-route";

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

describe("AuthenticatedRoute", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("renders a loading state while the session is pending", () => {
    mockUseAuth.mockReturnValue(authState({ status: "pending", isPending: true }));

    renderGuard(<AuthenticatedRoute />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an error state and retries via refetch when the session fails to load", () => {
    const refetch = vi.fn();
    mockUseAuth.mockReturnValue(authState({ status: "error", refetch }));

    renderGuard(<AuthenticatedRoute />);

    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("redirects to /login and preserves the originating location when unauthenticated", () => {
    mockUseAuth.mockReturnValue(authState({ status: "unauthenticated", isAuthenticated: false }));

    renderGuard(<AuthenticatedRoute />, { initialEntries: ["/dashboard/tasks?foo=bar"] });

    const probe = screen.getByTestId("route-probe");

    expect(probe.dataset.pathname).toBe("/login");
    expect(probe.dataset.from).toBe("/dashboard/tasks?foo=bar");
  });

  it("renders the protected content when authenticated", () => {
    mockUseAuth.mockReturnValue(authState({ status: "authenticated", isAuthenticated: true }));

    renderGuard(<AuthenticatedRoute />);

    expect(screen.getByText(PROTECTED_CONTENT_TEXT)).toBeInTheDocument();
  });
});
