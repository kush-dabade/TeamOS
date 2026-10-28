import { expect, test } from "@playwright/test";

import { E2E_API_ORIGIN, E2E_APP_ORIGIN } from "./stack-env.mjs";
import { PASSWORD, createWorkspace, login, readEmailLink, uniqueEmail } from "./support";

test.describe("registration, verification and sessions", () => {
  test("a new visitor registers, verifies, signs in, stays signed in and signs out", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // The confirmation describes a request, never a delivered email.
    await expect(page.getByText(`requested a verification email for ${email}`)).toBeVisible();

    // Unverified accounts can't sign in.
    await login(page, email);
    await expect(page.getByText("Email not verified")).toBeVisible();

    await page.goto(await readEmailLink("email-verification", email));
    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();

    await login(page, email);
    await createWorkspace(page, "E2E Signup Workspace");

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("E2E Signup Workspace").first()).toBeVisible();

    await page.getByRole("button", { name: /Ada Lovelace/ }).last().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the server rejects a password that breaks the advertised rules", async ({ request }) => {
    const response = await request.post(`${E2E_API_ORIGIN}/api/auth/sign-up/email`, {
      data: { name: "Weak", email: uniqueEmail("weak"), password: "alllowercase1" },
      headers: { Origin: E2E_APP_ORIGIN },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("PASSWORD_POLICY_VIOLATION");
  });

  test("a password reset link from the mailbox sets a new password", async ({ page }) => {
    const email = uniqueEmail("reset");
    await page.request.post(`${E2E_API_ORIGIN}/api/auth/sign-up/email`, {
      data: { name: "Reset User", email, password: PASSWORD },
      headers: { Origin: E2E_APP_ORIGIN },
    });
    await page.goto(await readEmailLink("email-verification", email));

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();

    await page.goto(await readEmailLink("password-reset", email));
    const newPassword = "Brandnew5678";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: /Reset password/ }).click();
    await expect(page.getByText("Password reset")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
