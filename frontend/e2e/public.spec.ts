import { expect, test } from "@playwright/test";

test.describe("public pages and route guards", () => {
  test("the landing page loads with its calls to action", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Try TeamOS" }).first()).toBeVisible();
  });

  test("protected routes send a signed-out visitor to login", async ({ page }) => {
    for (const path of ["/dashboard", "/projects", "/tasks", "/workspace/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("an unknown route shows the not-found page", async ({ page }) => {
    await page.goto("/definitely-not-a-page");

    await expect(page.getByText("Page not found")).toBeVisible();
  });
});
