import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentForm } from "./CommentForm";

// This repo's vitest config runs with `globals: false`, so Testing Library's
// automatic afterEach(cleanup) never registers - clean up explicitly before
// every render instead (see TaskForm.test.tsx for the same note).
beforeEach(() => {
  cleanup();
});

function renderForm(overrides: Partial<Parameters<typeof CommentForm>[0]> = {}) {
  const onSubmit = vi.fn();

  render(
    <CommentForm
      mode="create"
      placeholder="Add a comment..."
      submitLabel="Post"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

  return { onSubmit };
}

describe("CommentForm - error handling", () => {
  it("preserves the real AppError message instead of the generic fallback", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue({ type: "validation", message: "Comment failed moderation" });
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Comment failed moderation");
    });

    expect(
      screen.queryByText("Unable to save comment. Please try again."),
    ).not.toBeInTheDocument();
  });

  it("falls back to a generic message when the rejection has no usable message", async () => {
    const onSubmit = vi.fn().mockRejectedValue("network down");
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again.",
      );
    });
  });
});
