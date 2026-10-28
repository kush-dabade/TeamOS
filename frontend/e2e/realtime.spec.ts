import { expect, test } from "@playwright/test";

import { chooseOption, signedInWithWorkspace } from "./support";

// Regression (audit F-04): task events reached the browser but /tasks kept
// showing the old list until a reload.
test("a task created in one tab appears in another tab's task list without a reload", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const editor = await context.newPage();
  await signedInWithWorkspace(editor, "realtime");

  await editor.goto("/projects");
  await editor.getByRole("button", { name: "New project" }).click();
  await editor.getByRole("dialog").getByLabel("Project Name").fill("Realtime Board");
  await editor.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await expect(editor.getByText("Project created")).toBeVisible();

  // Same session, second tab, parked on the workspace-wide task list.
  const watcher = await context.newPage();
  await watcher.goto("/tasks");
  await expect(watcher.getByText("No tasks yet").or(watcher.locator("table"))).toBeVisible();

  await editor.goto("/tasks");
  await editor.getByRole("button", { name: "Create task" }).first().click();
  const panel = editor.getByRole("dialog");
  await panel.getByLabel(/^Title/).fill("Arrives live");
  await chooseOption(editor, /^Project/, "Realtime Board");
  await panel.getByRole("button", { name: "Create task" }).click();
  await expect(editor.getByText("Task created")).toBeVisible();

  await expect(watcher.locator("tr", { hasText: "Arrives live" })).toBeVisible({ timeout: 15_000 });

  await context.close();
});
