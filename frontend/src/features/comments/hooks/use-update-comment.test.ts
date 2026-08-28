import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { updateComment } from "../api/comments.api";
import { useUpdateComment } from "./use-update-comment";

vi.mock("../api/comments.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockUpdateComment = vi.mocked(updateComment);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useUpdateComment", () => {
  beforeEach(() => {
    mockUpdateComment.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("does not toast on a rejected mutation - CommentForm's inline error is the only surface", async () => {
    mockUpdateComment.mockRejectedValue({ type: "validation", message: "Comment failed moderation" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useUpdateComment(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ commentId: "comment-1", taskId: "task-1", input: { content: "Edited" } });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});
