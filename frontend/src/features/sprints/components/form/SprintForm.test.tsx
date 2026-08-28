import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SprintFormData } from "../../validation/sprint";

import { SprintForm } from "./SprintForm";

// This repo's vitest config runs with `globals: false`, so Testing Library's
// automatic afterEach(cleanup) never registers - clean up explicitly before
// every render instead (see TaskForm.test.tsx for the same note).
beforeEach(() => {
  cleanup();
});

const editDefaultValues: SprintFormData = {
  name: "Existing sprint",
  goal: "",
  startDate: "",
  endDate: "",
};

function renderForm(overrides: Partial<Parameters<typeof SprintForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const nameInputRef = createRef<HTMLInputElement>();

  render(
    <SprintForm
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

describe("SprintForm - error handling", () => {
  it("preserves the real AppError message instead of the generic fallback", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue({ type: "validation", message: "Sprint name already exists" });
    renderForm({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Sprint name already exists");
    });

    expect(
      screen.queryByText("Unable to save sprint. Please try again."),
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
