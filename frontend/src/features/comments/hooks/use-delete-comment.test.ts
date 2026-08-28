import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { deleteComment } from "../api/comments.api";
import { useDeleteComment } from "./use-delete-comment";

vi.mock("../api/comments.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockDeleteComment = vi.mocked(deleteComment);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Regression guard: useDeleteComment is button/dialog-triggered, not
// form-backed, so unlike useCreateComment/useUpdateComment it has no inline
// error slot to fall back to - its toast must survive the PR 3 cleanup.
describe("useDeleteComment", () => {
  beforeEach(() => {
    mockDeleteComment.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("still toasts on a rejected mutation", async () => {
    mockDeleteComment.mockRejectedValue({ type: "server", message: "Unable to delete comment" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useDeleteComment(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ commentId: "comment-1", taskId: "task-1" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith("Unable to delete comment");
  });
});
