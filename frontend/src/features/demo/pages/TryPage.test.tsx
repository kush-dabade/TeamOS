import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/features/auth";
import { renderGuard } from "@/test/render-guard";

import type { DemoSession } from "../api/demo.api";
import { useCreateDemoSession } from "../hooks/use-create-demo-session";
import { TryPage } from "./TryPage";

vi.mock("@/features/auth");
vi.mock("../hooks/use-create-demo-session");

const mockUseAuth = vi.mocked(useAuth);
const mockUseCreateDemoSession = vi.mocked(useCreateDemoSession);

type AuthState = ReturnType<typeof useAuth>;
type MutationState = ReturnType<typeof useCreateDemoSession>;

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

function mutationState(overrides: Partial<MutationState> = {}): MutationState {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    ...overrides,
  } as MutationState;
}

describe("TryPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseCreateDemoSession.mockReset();
  });

  it("redirects an already-authenticated visitor straight to /dashboard without provisioning a new demo session", () => {
    mockUseAuth.mockReturnValue(authState({ status: "authenticated", isAuthenticated: true }));

    const mutate = vi.fn();
    mockUseCreateDemoSession.mockReturnValue(mutationState({ mutate }));

    renderGuard(<TryPage />);

    expect(screen.getByTestId("route-probe").dataset.pathname).toBe("/dashboard");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the loading state and automatically provisions exactly once for an unauthenticated visitor", () => {
    mockUseAuth.mockReturnValue(authState({ status: "unauthenticated", isAuthenticated: false }));

    const mutate = vi.fn();
    mockUseCreateDemoSession.mockReturnValue(mutationState({ mutate }));

    renderGuard(<TryPage />);

    expect(screen.getByText("Preparing your workspace")).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("does not provision while the session check is still pending, but does once it settles unauthenticated", () => {
    mockUseAuth.mockReturnValue(authState({ status: "pending", isPending: true }));

    const mutate = vi.fn();
    mockUseCreateDemoSession.mockReturnValue(mutationState({ mutate }));

    renderGuard(<TryPage />);

    expect(mutate).not.toHaveBeenCalled();
  });

  it(
    "refetches the auth session before navigating to /dashboard on successful provisioning - " +
      "POST /demo/session goes through apiClient, not authClient, so nothing else would ever " +
      "refresh Better Auth's session cache before AuthenticatedRoute reads it",
    async () => {
      const refetch = vi.fn().mockResolvedValue(undefined);
      const fakeSession: DemoSession = { expiresAt: "2026-09-01T00:00:00.000Z" };

      const mutate = vi.fn((_variables: void, options?: { onSuccess?: (data: DemoSession) => unknown }) => {
        options?.onSuccess?.(fakeSession);
      });

      mockUseAuth.mockReturnValue(
        authState({ status: "unauthenticated", isAuthenticated: false, refetch }),
      );
      mockUseCreateDemoSession.mockReturnValue(mutationState({ mutate }));

      renderGuard(<TryPage />);

      await waitFor(() => {
        expect(screen.getByTestId("route-probe").dataset.pathname).toBe("/dashboard");
      });

      expect(refetch).toHaveBeenCalledTimes(1);
    },
  );

  it("shows the error state on failed provisioning, and lets the visitor retry or go back to the landing page", () => {
    mockUseAuth.mockReturnValue(authState({ status: "unauthenticated", isAuthenticated: false }));

    const mutate = vi.fn();
    mockUseCreateDemoSession.mockReturnValue(mutationState({ mutate, isError: true }));

    renderGuard(<TryPage />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    const backLink = screen.getByRole("link", { name: "Back to TeamOS" });
    expect(backLink).toHaveAttribute("href", "/");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Once automatically on mount, once from the explicit retry click.
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});
