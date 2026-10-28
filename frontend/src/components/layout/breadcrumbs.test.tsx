import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Breadcrumbs } from "./breadcrumbs";

const activeProjects = vi.fn();
const archivedProjects = vi.fn();

vi.mock("@/features/projects", () => ({
  useProjects: (workspaceId: string | undefined, status?: string) =>
    status === "ARCHIVED" ? archivedProjects(workspaceId) : activeProjects(workspaceId),
}));
const mockUseTask = vi.fn<
  (taskId: string | undefined, options?: { enabled?: boolean }) => { data: undefined }
>(() => ({ data: undefined }));
vi.mock("@/features/tasks", () => ({
  useTask: (taskId: string | undefined, options?: { enabled?: boolean }) => mockUseTask(taskId, options),
}));
vi.mock("@/features/workspaces", () => ({
  useActiveWorkspace: () => ({ workspace: { id: "workspace-1" } }),
}));
vi.mock("@/hooks", () => ({ useCurrentRoute: () => null }));

function project(slug: string, name: string) {
  return { project: { slug, name } };
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:slug" element={<Breadcrumbs />} />
        <Route path="/tasks/:taskId" element={<Breadcrumbs />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  activeProjects.mockReset();
  archivedProjects.mockReset().mockReturnValue({ data: undefined, isSuccess: false });
});

// Regression (audit F-17): the breadcrumb title-cased the URL slug, which is
// fixed at creation, so it kept showing the old name after a rename.
describe("Breadcrumbs on a project page", () => {
  it("shows the project's current name, not one derived from its slug", () => {
    activeProjects.mockReturnValue({
      data: [project("website-redesign", "Marketing Site v2")],
      isSuccess: true,
    });

    renderAt("/projects/website-redesign");

    expect(screen.getByText("Marketing Site v2")).toBeTruthy();
    expect(screen.queryByText("Website Redesign")).toBeNull();
  });

  it("falls back to the archived list for an archived project", () => {
    activeProjects.mockReturnValue({ data: [], isSuccess: true });
    archivedProjects.mockReturnValue({
      data: [project("old-launch", "Launch 2025 (archived)")],
      isSuccess: true,
    });

    renderAt("/projects/old-launch");

    expect(archivedProjects).toHaveBeenCalledWith("workspace-1");
    expect(screen.getByText("Launch 2025 (archived)")).toBeTruthy();
  });

  it("uses the slug only while the project lists are loading", () => {
    activeProjects.mockReturnValue({ data: undefined, isSuccess: false });

    renderAt("/projects/website-redesign");

    expect(screen.getByText("Website Redesign")).toBeTruthy();
    expect(archivedProjects).toHaveBeenCalledWith(undefined);
  });
});

// Regression (audit F-24): the breadcrumb ran its own fetch of the task, so
// deleting a task from its page refetched it (and got a 404) through here.
describe("Breadcrumbs on a task page", () => {
  it("reads the task from the page's query without fetching it", () => {
    activeProjects.mockReturnValue({ data: undefined, isSuccess: false });

    renderAt("/tasks/task-1");

    expect(mockUseTask).toHaveBeenCalledWith("task-1", { enabled: false });
  });
});
