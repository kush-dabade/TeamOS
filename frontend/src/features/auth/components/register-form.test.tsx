import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { register } from "../api/auth.api";
import { toast } from "sonner";

import { RegisterForm } from "./register-form";

vi.mock("../api/auth.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockRegister = vi.mocked(register);

function CurrentPath() {
  const location = useLocation();

  return <p data-testid="current-path">{`${location.pathname}${location.search}`}</p>;
}

// `from` mirrors the state InvitationPage's register link (and
// AuthenticatedRoute, via the login page's sign-up link) passes to /register.
function renderForm(from?: { pathname: string; search?: string }) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: "/register", state: from ? { from } : null }]}>
        <Routes>
          <Route path="/register" element={<RegisterForm />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "Password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

// Verification email is enqueued asynchronously and its delivery can fail
// long after sign-up returns, so the success state must describe a request,
// never a completed delivery.
describe("RegisterForm success state", () => {
  beforeEach(() => {
    cleanup();
    mockRegister.mockReset();
  });

  it("describes the verification email as requested, not sent", async () => {
    mockRegister.mockResolvedValue({ sessionCreated: false });

    renderForm();
    fillAndSubmit();

    expect(
      await screen.findByText(/requested a verification email for ada@example\.com/),
    ).toBeTruthy();
    expect(screen.queryByText(/We sent/)).toBeNull();
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy();
  });

  it("stays on the form when sign-up is rejected", async () => {
    mockRegister.mockRejectedValue({ type: "validation", message: "Invalid email" });

    renderForm();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/requested a verification email/)).toBeNull();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });
});

// Backend REQUIRE_EMAIL_VERIFICATION=false: sign-up returns a session, so the
// form continues like a successful login instead of asking for verification.
describe("RegisterForm when sign-up creates a session", () => {
  beforeEach(() => {
    cleanup();
    mockRegister.mockReset();
    vi.mocked(toast.success).mockClear();
  });

  it("navigates to the dashboard by default", async () => {
    mockRegister.mockResolvedValue({ sessionCreated: true });

    renderForm();
    fillAndSubmit();

    expect((await screen.findByTestId("current-path")).textContent).toBe("/dashboard");
    expect(screen.queryByText(/requested a verification email/)).toBeNull();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("returns to the page that sent the guest to sign up, such as an invitation", async () => {
    mockRegister.mockResolvedValue({ sessionCreated: true });

    renderForm({ pathname: "/invitations/invite-token", search: "?ref=email" });
    fillAndSubmit();

    expect((await screen.findByTestId("current-path")).textContent).toBe(
      "/invitations/invite-token?ref=email",
    );
  });
});
