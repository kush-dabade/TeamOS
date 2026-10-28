import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskListItem } from "../types";

import { TasksPage } from "./TasksPage";

// Radix primitives (Select, Sheet, AlertDialog) touch browser APIs jsdom
// lacks - same stubs as TaskForm.test.tsx.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockWorkspace = { id: "workspace-1", role: "MEMBER" as string };
vi.mock("@/features/workspaces", () => ({
  useActiveWorkspace: () => ({ workspace: mockWorkspace }),
  useWorkspaceMembers: () => ({ data: [] }),
}));
vi.mock("@/features/auth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/features/projects", () => ({
  useProjects: () => ({
    data: [{ project: { id: "project-1", slug: "launch", name: "Launch" } }],
  }),
}));
vi.mock("@/features/sprints/hooks/use-sprints", () => ({ useSprints: () => ({ data: [] }) }));

function buildTask(id: string, title: string, overrides: Partial<TaskListItem["task"]> = {}): TaskListItem {
  return {
    task: {
      id,
      workspaceId: "workspace-1",
      projectId: "project-1",
      title,
      description: null,
      status: "TODO",
      priority: "MEDIUM",
      dueDate: null,
      createdById: "user-1",
      assigneeId: null,
      completedAt: null,
      deletedAt: null,
      sprintId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      ...overrides,
    },
    assignee: null,
    project: { id: "project-1", slug: "launch", name: "Launch" },
  };
}

const TASKS = [
  buildTask("task-1", "Write launch copy", { status: "DONE", priority: "URGENT" }),
  buildTask("task-2", "Fix login bug", { status: "TODO", priority: "LOW" }),
];

vi.mock("../hooks/use-tasks", () => ({
  useTasks: () => ({ tasks: TASKS, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("../hooks/use-create-task", () => ({ useCreateTask: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("../hooks/use-update-task", () => ({ useUpdateTask: () => ({ mutateAsync: vi.fn() }) }));
const mockDelete = vi.fn();
vi.mock("../hooks/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: mockDelete, isPending: false }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/tasks"
          element={
            <>
              <TasksPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function visibleTaskTitles(): string[] {
  return ["Write launch copy", "Fix login bug"].filter((title) => screen.queryByText(title));
}

beforeEach(() => {
  cleanup();
  mockDelete.mockReset();
  mockWorkspace.role = "MEMBER";
});

// Regression (audit F-15): filters lived only in component state and reset
// on refresh.
describe("TasksPage filters in the URL", () => {
  it("applies status and priority filters from the URL", () => {
    renderAt("/tasks?status=DONE&priority=URGENT");

    expect(visibleTaskTitles()).toEqual(["Write launch copy"]);
  });

  it("ignores an unknown filter value instead of hiding everything", () => {
    renderAt("/tasks?status=BOGUS");

    expect(visibleTaskTitles()).toEqual(["Write launch copy", "Fix login bug"]);
  });

  it("clears the filter parameters from the URL, keeping unrelated ones", () => {
    renderAt("/tasks?status=REVIEW&priority=HIGH&project=project-1&tab=x");

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByTestId("location").textContent).toBe("?tab=x");
    expect(visibleTaskTitles()).toEqual(["Write launch copy", "Fix login bug"]);
  });
});

// Regression (audit F-14): the /tasks preview offered Edit but not Delete,
// unlike the project page's task preview.
describe("TasksPage task preview actions", () => {
  it("lets a member delete the previewed task", async () => {
    mockDelete.mockResolvedValue(undefined);
    renderAt("/tasks");

    fireEvent.click(screen.getByRole("button", { name: "Fix login bug" }));
    const preview = await screen.findByRole("dialog");
    fireEvent.click(within(preview).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        taskId: "task-2",
        projectId: "project-1",
        sprintId: null,
      });
    });
  });

  it("offers neither edit nor delete to a guest", async () => {
    mockWorkspace.role = "GUEST";
    renderAt("/tasks");

    fireEvent.click(screen.getByRole("button", { name: "Fix login bug" }));
    const preview = await screen.findByRole("dialog");

    expect(within(preview).queryByRole("button", { name: "Delete" })).toBeNull();
    expect(within(preview).queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
