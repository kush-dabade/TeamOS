import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestPasswordReset } from "../api/auth.api";
import { ForgotPasswordForm } from "./forgot-password-form";

vi.mock("../api/auth.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockRequestPasswordReset = vi.mocked(requestPasswordReset);

async function submit(email: string): Promise<string> {
  render(
    <MemoryRouter>
      <ForgotPasswordForm />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

  return (await screen.findByText(/If an account exists/)).textContent ?? "";
}

// The backend answers identically whether or not the account exists, so the
// confirmation must too - and, since delivery happens asynchronously in the
// worker, it must not promise that an email has already been sent.
describe("ForgotPasswordForm confirmation", () => {
  beforeEach(() => {
    cleanup();
    mockRequestPasswordReset.mockReset();
    mockRequestPasswordReset.mockResolvedValue(undefined);
  });

  it("shows the same non-enumerating message for any address", async () => {
    const first = await submit("known@example.com");
    cleanup();
    const second = await submit("unknown@example.com");

    expect(first).toBe(second);
    expect(first).not.toContain("known@example.com");
  });

  it("does not claim the email was already sent", async () => {
    const message = await submit("someone@example.com");

    expect(message).not.toMatch(/\b(sent|you'll receive)\b/i);
  });
});
