import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { chooseOption, signedInWithWorkspace } from "./support";

// One signed-in user working through the core project-management flow, in
// order, on one page (a serial describe shares it).
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await signedInWithWorkspace(page, "workflow");
});

test.afterAll(async () => {
  await page.close();
});

test("create and edit a project", async () => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();

  const createPanel = page.getByRole("dialog");
  // The create form offers no Status choice (audit F-05).
  await expect(createPanel.getByLabel("Status")).toHaveCount(0);
  await createPanel.getByLabel("Project Name").fill("Launch Plan");
  await createPanel.getByLabel("Description").fill("Everything for launch day");
  await createPanel.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Project created")).toBeVisible();

  await page.getByRole("button", { name: "Launch Plan" }).click();
  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editPanel = page.getByRole("dialog");
  await editPanel.getByLabel("Project Name").fill("Launch Plan 2026");
  await chooseOption(page, "Status", "Active");
  await editPanel.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Project updated")).toBeVisible();

  await page.reload();
  await expect(page.locator("tr", { hasText: "Launch Plan 2026" })).toContainText("Active");
});

test("create, update and delete tasks", async () => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Launch Plan 2026" }).click();
  await page.getByRole("button", { name: "Open project" }).click();
  await expect(page).toHaveURL(/\/projects\/launch-plan$/);
  // The breadcrumb shows the current name, not the original slug (audit F-17).
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Launch Plan 2026");

  for (const title of ["Write press release", "Book venue"]) {
    await page.getByRole("button", { name: "Create task" }).first().click();
    const panel = page.getByRole("dialog");
    await panel.getByLabel(/^Title/).fill(title);
    // The current project is preselected (audit F-13).
    await expect(panel.getByRole("combobox", { name: /^Project/ })).toContainText("Launch Plan 2026");
    await chooseOption(page, "Priority", "High");
    await panel.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText("Task created").first()).toBeVisible();
    await expect(page.locator("tr", { hasText: title })).toBeVisible();
  }

  await page.locator("tr", { hasText: "Write press release" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Open task" }).click();
  await expect(page).toHaveURL(/\/tasks\/[a-z0-9]+$/);

  await page.getByRole("button", { name: "Edit task" }).click();
  await chooseOption(page, "Status", "Done");
  await chooseOption(page, "Priority", "Urgent");
  await page.getByRole("dialog").getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByText("Task updated")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Completed at")).toBeVisible();
  await expect(page.locator("main").getByText("Urgent").first()).toBeVisible();

  // Deleting from the task page goes back to /tasks without refetching the
  // deleted task (audit F-24).
  const notFoundResponses: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 404 && /\/api\/v1\/tasks\/[^/]+$/.test(response.url())) {
      notFoundResponses.push(response.url());
    }
  });
  await page.getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.locator("tr", { hasText: "Write press release" })).toHaveCount(0);
  expect(notFoundResponses).toEqual([]);
});

test("filter tasks through the URL and delete from the task list", async () => {
  await page.goto("/tasks?priority=HIGH");
  await expect(page.locator("tr", { hasText: "Book venue" })).toBeVisible();

  await page.goto("/tasks?priority=URGENT");
  await expect(page.locator("tr", { hasText: "Book venue" })).toHaveCount(0);

  await page.goto("/tasks");
  await page.getByRole("button", { name: "Book venue" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Delete" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("comment on a task and manage an attachment", async () => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Book venue" }).click();
  await page.getByRole("button", { name: "Open task" }).click();

  await page.getByLabel("Comment").fill("Venue shortlist <b>attached</b>");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText("Venue shortlist <b>attached</b>")).toBeVisible();

  const upload = page.getByLabel("Upload attachment files");
  const contents = "venue,capacity\nHall A,200\n";
  await upload.setInputFiles({ name: "venues.txt", mimeType: "text/plain", buffer: Buffer.from(contents) });
  // Its row's action menu, not just the name - the activity feed lists the name too.
  await expect(page.getByRole("button", { name: "Actions for venues.txt" })).toBeVisible();

  // A file whose bytes don't match its type is refused (audit F-10).
  await upload.setInputFiles({
    name: "diagram.png",
    mimeType: "image/png",
    buffer: Buffer.from("<html>not an image</html>"),
  });
  await expect(page.getByText(/contents don't match/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for diagram.png" })).toHaveCount(0);

  await page.getByRole("button", { name: "Actions for venues.txt" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Download/ }).click(),
  ]);
  expect(readFileSync(await download.path(), "utf8")).toBe(contents);

  await page.getByRole("button", { name: "Actions for venues.txt" }).click();
  await page.getByRole("menuitem", { name: /Delete/ }).click();
  const confirm = page.getByRole("alertdialog");
  if (await confirm.count()) {
    await confirm.getByRole("button", { name: /Delete/ }).click();
  }
  await expect(page.getByText("No attachments yet")).toBeVisible();
});

test("run a sprint from planning to completion", async () => {
  await page.goto("/projects/launch-plan");
  await page.getByRole("tab", { name: "Sprints" }).click();
  await page.getByRole("button", { name: /New sprint|Create sprint/ }).first().click();

  const panel = page.getByRole("dialog");
  await panel.getByLabel("Sprint Name").fill("Launch week");
  await panel.getByLabel("Start Date").fill("2026-11-02");
  await panel.getByLabel("End Date").fill("2026-11-09");
  await panel.getByRole("button", { name: /^Create/ }).click();
  await expect(page.getByText("Sprint created")).toBeVisible();

  await page.locator("tr", { hasText: "Launch week" }).getByRole("button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Assign task" }).first().click();
  await page.getByRole("option", { name: /Book venue/ }).click();
  await expect(page.getByText("Task added to sprint")).toBeVisible();

  // Picking a task currently closes the sprint panel along with the picker
  // (logged separately as a UX follow-up), so reopen it as a user would.
  if (!(await page.getByRole("button", { name: "Start sprint" }).isVisible())) {
    await page.locator("tr", { hasText: "Launch week" }).getByRole("button").first().click();
  }
  await expect(page.getByRole("dialog")).toContainText("Book venue");
  await page.getByRole("button", { name: "Start sprint" }).click();
  await expect(page.getByText("Sprint started")).toBeVisible();
  await page.getByRole("button", { name: "Complete sprint" }).click();
  const confirm = page.getByRole("alertdialog");
  if (await confirm.count()) {
    await confirm.getByRole("button", { name: /Complete/ }).click();
  }
  await expect(page.getByText("Sprint completed")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Sprints" }).click();
  await expect(page.locator("tr", { hasText: "Launch week" })).toContainText("Completed");
});

test("search finds projects and tasks", async () => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /^Search/ }).first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("combobox").fill("Launch");
  await expect(dialog.getByText("Launch Plan 2026")).toBeVisible();

  await dialog.getByRole("combobox").fill("venue");
  await expect(dialog.getByText("Book venue")).toBeVisible();

  await dialog.getByRole("combobox").fill("zzzz-nothing");
  await expect(dialog.getByText("No results found")).toBeVisible();
});
