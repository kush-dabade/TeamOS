import { expect, test } from "@playwright/test";

import { E2E_API_ORIGIN } from "./stack-env.mjs";
import { signedInWithWorkspace } from "./support";

test("another tenant can neither open nor read a workspace's project", async ({ browser }) => {
  const ownerPage = await browser.newPage();
  await signedInWithWorkspace(ownerPage, "tenant-a");
  await ownerPage.goto("/projects");
  await ownerPage.getByRole("button", { name: "New project" }).click();
  await ownerPage.getByRole("dialog").getByLabel("Project Name").fill("Private Roadmap");
  await ownerPage.getByRole("dialog").getByLabel("Description").fill("Confidential acquisition plans");
  await ownerPage.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await expect(ownerPage.getByText("Project created")).toBeVisible();

  const projects = await ownerPage.request.get(
    `${E2E_API_ORIGIN}/api/v1/workspaces/${await activeWorkspaceId(ownerPage)}/projects`,
  );
  const project = (await projects.json()).data.find(
    (item: { name: string }) => item.name === "Private Roadmap",
  ) as { id: string; slug: string };

  const outsiderPage = await browser.newPage();
  await signedInWithWorkspace(outsiderPage, "tenant-b");

  await outsiderPage.goto(`/projects/${project.slug}`);
  await expect(outsiderPage.getByText("Project not found")).toBeVisible();
  // Only what the outsider typed into the URL (the slug) can appear - nothing
  // that comes from the project itself.
  await expect(outsiderPage.getByText("Confidential acquisition plans")).toHaveCount(0);

  const direct = await outsiderPage.request.get(`${E2E_API_ORIGIN}/api/v1/projects/${project.id}`);
  expect(direct.status()).toBe(403);

  await ownerPage.close();
  await outsiderPage.close();
});

async function activeWorkspaceId(page: import("@playwright/test").Page): Promise<string> {
  const response = await page.request.get(`${E2E_API_ORIGIN}/api/v1/workspaces`);
  const workspaces = (await response.json()).data as Array<{ id: string }>;
  return workspaces[0]?.id as string;
}
