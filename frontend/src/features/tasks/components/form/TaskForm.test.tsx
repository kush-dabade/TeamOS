import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskAssignee, TaskProject } from "../../types";
import { taskSchema, type TaskFormData } from "../../validation/task";

import { TaskForm } from "./TaskForm";

// Radix Select (via the `radix-ui` package) reads pointer-capture/scroll/
// resize APIs jsdom doesn't implement, and throws "not implemented" without
// them. Stubbed once, scoped to this file, so opening the dropdown below
// doesn't require a real browser.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

// This repo's vitest config runs with `globals: false`, so Testing Library's
// automatic afterEach(cleanup) never registers (see src/test/render-guard.tsx
// for the same note) - clean up explicitly before every render instead.
beforeEach(() => {
  cleanup();
});

const projects: TaskProject[] = [{ id: "project-1", slug: "project-1", name: "Project One" }];
const assignees: TaskAssignee[] = [{ id: "user-1", name: "Ada Lovelace", image: null }];

const createDefaultValues: TaskFormData = {
  title: "",
  projectId: "",
  description: "",
  priority: "MEDIUM",
  status: "TODO",
  assigneeId: "",
  dueDate: "",
};

const editDefaultValues: TaskFormData = {
  title: "Existing task",
  projectId: "project-1",
  description: "",
  priority: "MEDIUM",
  status: "IN_PROGRESS",
  assigneeId: "",
  dueDate: "",
};

function renderForm(overrides: Partial<Parameters<typeof TaskForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const titleInputRef = createRef<HTMLInputElement>();

  render(
    <TaskForm
      mode="create"
      defaultValues={createDefaultValues}
      projects={projects}
      assignees={assignees}
      titleInputRef={titleInputRef}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel };
}

describe("TaskForm - status control", () => {
  it("shows a status control in edit mode exposing all four supported statuses", () => {
    renderForm({ mode: "edit", defaultValues: editDefaultValues });

    const statusControl = screen.getByLabelText("Status");
    fireEvent.click(statusControl);

    expect(screen.getByRole("option", { name: "Todo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "In Progress" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Done" })).toBeInTheDocument();
  });

  it("does not show a status control in create mode", () => {
    renderForm({ mode: "create" });

    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("seeds the current task status when editing", () => {
    renderForm({ mode: "edit", defaultValues: editDefaultValues });

    expect(screen.getByLabelText("Status")).toHaveTextContent("In Progress");
  });

  it("includes the selected status in the submitted form data", async () => {
    const { onSubmit } = renderForm({ mode: "edit", defaultValues: editDefaultValues });

    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(screen.getByRole("option", { name: "Done" }));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "DONE" }));
  });
});

describe("taskSchema - status validation", () => {
  const validBase = {
    title: "Valid task title",
    projectId: "project-1",
    description: "",
    priority: "MEDIUM" as const,
    assigneeId: "",
    dueDate: "",
  };

  it("accepts every supported TaskStatus value", () => {
    const statuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

    for (const status of statuses) {
      const candidate = { ...validBase, status };
      expect(taskSchema.safeParse(candidate).success).toBe(true);
    }
  });

  it("rejects an unsupported status value", () => {
    const candidate = { ...validBase, status: "ARCHIVED" };
    expect(taskSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects a missing status", () => {
    expect(taskSchema.safeParse(validBase).success).toBe(false);
  });
});
