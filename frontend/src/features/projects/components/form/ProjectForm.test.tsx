import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectFormData } from "../../validation/project";

import { ProjectForm } from "./ProjectForm";

// Radix Select (via the `radix-ui` package) reads pointer-capture/scroll/
// resize APIs jsdom doesn't implement, and throws "not implemented" without
// them - same stub as TaskForm.test.tsx, needed because ProjectForm renders
// a Status Select even when a test never opens it.
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
// automatic afterEach(cleanup) never registers - clean up explicitly before
// every render instead (see TaskForm.test.tsx for the same note).
beforeEach(() => {
  cleanup();
});

const editDefaultValues: ProjectFormData = {
  name: "Existing project",
  description: "",
  status: "ACTIVE",
};

function renderForm(overrides: Partial<Parameters<typeof ProjectForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const nameInputRef = createRef<HTMLInputElement>();

  render(
    <ProjectForm
      mode="edit"
      defaultValues={editDefaultValues}
      nameInputRef={nameInputRef}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel };
}

describe("ProjectForm - error handling", () => {
  it("preserves the real AppError message instead of the generic fallback", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue({ type: "validation", message: "Project name already exists" });
    renderForm({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Project name already exists");
    });

    expect(
      screen.queryByText("Unable to save project. Please try again."),
    ).not.toBeInTheDocument();
  });

  it("falls back to a generic message when the rejection has no usable message", async () => {
    const onSubmit = vi.fn().mockRejectedValue("network down");
    renderForm({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again.",
      );
    });
  });
});
