import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

// Regression: found by the e2e suite - after a successful sign-up the
// session refetch made the guard show the loader, which unmounted the
// register form and discarded its "check your email" state.
describe("GuestRoute across a session refetch", () => {
  function StatefulGuestPage() {
    const [value, setValue] = useState("");
    return <input aria-label="Guest input" value={value} onChange={(event) => setValue(event.target.value)} />;
  }

  function renderStatefulGuard() {
    cleanup();
    return render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/register" element={<StatefulGuestPage />} />
          </Route>
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("keeps the guest page mounted, with its state, when the session refetches", () => {
    mockUseAuth.mockReturnValue(authState({ status: "unauthenticated" }));
    const { rerender } = renderStatefulGuard();

    fireEvent.change(screen.getByLabelText("Guest input"), { target: { value: "typed" } });

    mockUseAuth.mockReturnValue(authState({ status: "pending", isPending: true }));
    rerender(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/register" element={<StatefulGuestPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByLabelText("Guest input") as HTMLInputElement).value).toBe("typed");
  });

  it("still redirects once a session appears after the refetch", () => {
    mockUseAuth.mockReturnValue(authState({ status: "unauthenticated" }));
    const { rerender } = renderStatefulGuard();

    mockUseAuth.mockReturnValue(authState({ status: "authenticated", isAuthenticated: true }));
    rerender(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/register" element={<StatefulGuestPage />} />
          </Route>
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
