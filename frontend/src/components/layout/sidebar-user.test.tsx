import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

import { SidebarUser } from "./sidebar-user";

const mockUser = vi.fn();
vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: mockUser() }),
  logout: vi.fn(),
}));

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  cleanup();
});

function renderSidebarUser() {
  render(
    <MemoryRouter>
      <SidebarProvider>
        <SidebarUser />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

// Regression (audit F-21): the sidebar showed demo users their generated
// demo-<uuid>@teamos.local address.
describe("SidebarUser", () => {
  it("labels a demo account instead of showing its generated address", () => {
    mockUser.mockReturnValue({
      id: "u1",
      name: "Guest",
      email: "demo-0b9e@teamos.local",
      image: null,
      isDemo: true,
    });

    renderSidebarUser();

    expect(screen.getByText("Demo account")).toBeTruthy();
    expect(screen.queryByText(/teamos\.local/)).toBeNull();
  });

  it("shows a real user's email", () => {
    mockUser.mockReturnValue({ id: "u2", name: "Ada", email: "ada@example.com", image: null });

    renderSidebarUser();

    expect(screen.getByText("ada@example.com")).toBeTruthy();
  });
});
