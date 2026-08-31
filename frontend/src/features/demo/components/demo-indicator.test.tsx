import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDemoStatus } from "../hooks/use-demo-status";
import { DemoIndicator } from "./demo-indicator";

vi.mock("../hooks/use-demo-status");

const mockUseDemoStatus = vi.mocked(useDemoStatus);

// Vitest config runs with globals: false (see vitest.config.ts), so
// Testing Library's automatic afterEach(cleanup) never registers - same
// rationale as test/render-guard.tsx's renderGuard.
function renderIndicator() {
  cleanup();

  render(
    <MemoryRouter>
      <DemoIndicator />
    </MemoryRouter>,
  );
}

describe("DemoIndicator", () => {
  beforeEach(() => {
    mockUseDemoStatus.mockReset();
  });

  it("renders nothing for a normal (non-demo) user", () => {
    mockUseDemoStatus.mockReturnValue({ isDemo: false, expiresAt: null });

    renderIndicator();

    expect(screen.queryByText(/demo workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  });

  it("shows the demo workspace label, a reasonable expiry description, and a sign-up link for a demo user", () => {
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    mockUseDemoStatus.mockReturnValue({ isDemo: true, expiresAt });

    renderIndicator();

    expect(screen.getByText(/demo workspace/i)).toBeInTheDocument();
    // Doesn't assert the exact wording date-fns produces (e.g. "in about 3
    // hours") - only that it communicates a future expiry, not an already-
    // expired one.
    expect(screen.getByText(/expires in/i)).toBeInTheDocument();

    const signUpLink = screen.getByRole("link", { name: "Sign up" });
    expect(signUpLink).toHaveAttribute("href", "/register");
  });

  it("shows an 'expiring soon' fallback instead of a negative duration when demoExpiresAt has already passed", () => {
    const expiresAt = new Date(Date.now() - 60_000);
    mockUseDemoStatus.mockReturnValue({ isDemo: true, expiresAt });

    renderIndicator();

    expect(screen.getByText(/demo workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/expiring soon/i)).toBeInTheDocument();
  });
});
