import { cleanup, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskProject } from "../../types";

import { TaskFormPanel } from "./TaskFormPanel";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  cleanup();
});

function renderPanel(projects: TaskProject[]) {
  render(
    <TaskFormPanel
      mode="create"
      taskItem={null}
      projects={projects}
      assignees={[]}
      open
      onClose={vi.fn()}
      onCloseAutoFocus={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
}

const launch: TaskProject = { id: "project-1", slug: "launch", name: "Launch" };
const website: TaskProject = { id: "project-2", slug: "website", name: "Website" };

// Regression (audit F-13): creating a task from inside a project showed that
// project as the only choice but left it unselected.
describe("TaskFormPanel project selection", () => {
  it("preselects the only available project", () => {
    renderPanel([launch]);

    expect(screen.getByLabelText(/^Project/).textContent).toContain("Launch");
  });

  it("leaves the choice open when several projects are available", () => {
    renderPanel([launch, website]);

    expect(screen.getByLabelText(/^Project/).textContent).toContain("Select a project");
  });
});
