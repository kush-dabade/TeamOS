import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_API_ORIGIN, E2E_APP_ORIGIN, E2E_REDIS_DB, loadTestEnv } from "./stack-env.mjs";

const execFileAsync = promisify(execFile);
const testEnv = loadTestEnv();

export const PASSWORD = "Password1234";

export function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function redis(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "redis-cli",
    ["-h", testEnv.REDIS_HOST, "-p", testEnv.REDIS_PORT, "-n", String(E2E_REDIS_DB), "--no-auth-warning", ...args],
    { env: { ...process.env, REDISCLI_AUTH: testEnv.REDIS_PASSWORD } },
  );
  return stdout.trim();
}

/**
 * The test "mailbox": no email worker runs in the e2e stack, so every email
 * the backend asks to send stays in the BullMQ email queue with its exact
 * link. Reading it from there exercises the real sign-up / reset flow -
 * verification is never bypassed - without sending mail. Real delivery is a
 * separate, manual post-deploy check (docs/development/deployment.md).
 */
export async function readEmailLink(
  jobName: "email-verification" | "password-reset",
  email: string,
): Promise<string> {
  let found: string | undefined;

  await expect
    .poll(
      async () => {
        const keys = (await redis("--scan", "--pattern", `bull:email:${jobName}-*`))
          .split("\n")
          .filter((key) => key && !key.includes(":", `bull:email:${jobName}-`.length));

        for (const key of keys) {
          const data = await redis("HGET", key, "data");
          if (!data) {
            continue;
          }
          const payload = JSON.parse(data) as { email: string; url: string };
          if (payload.email === email.toLowerCase()) {
            found = payload.url;
            return true;
          }
        }
        return false;
      },
      { message: `no ${jobName} email queued for ${email}`, timeout: 15_000 },
    )
    .toBe(true);

  return found as string;
}

export async function signUpViaApi(
  request: APIRequestContext,
  email: string,
  name = "E2E User",
): Promise<void> {
  const response = await request.post(`${E2E_API_ORIGIN}/api/auth/sign-up/email`, {
    data: { name, email, password: PASSWORD },
    headers: { Origin: E2E_APP_ORIGIN },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

/** Signs up and follows the real verification link, as a user would. */
export async function createVerifiedUser(page: Page, label: string): Promise<string> {
  const email = uniqueEmail(label);
  await signUpViaApi(page.request, email);
  await page.goto(await readEmailLink("email-verification", email));
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
  return email;
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
}

export async function createWorkspace(page: Page, name: string): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create Workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A verified user, signed in, with a fresh workspace - the common starting point. */
export async function signedInWithWorkspace(page: Page, label: string): Promise<string> {
  const email = await createVerifiedUser(page, label);
  await login(page, email);
  await createWorkspace(page, `E2E ${label}`);
  return email;
}

export async function chooseOption(page: Page, label: string | RegExp, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
