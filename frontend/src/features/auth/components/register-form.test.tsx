import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { register } from "../api/auth.api";
import { RegisterForm } from "./register-form";

vi.mock("../api/auth.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockRegister = vi.mocked(register);

function renderForm() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <RegisterForm />
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
    mockRegister.mockResolvedValue(undefined);

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
