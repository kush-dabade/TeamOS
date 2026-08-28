import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { createComment } from "../api/comments.api";
import { useCreateComment } from "./use-create-comment";

vi.mock("../api/comments.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockCreateComment = vi.mocked(createComment);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useCreateComment", () => {
  beforeEach(() => {
    mockCreateComment.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("does not toast on a rejected mutation - CommentForm's inline error is the only surface", async () => {
    mockCreateComment.mockRejectedValue({ type: "validation", message: "Comment failed moderation" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCreateComment(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ taskId: "task-1", input: { content: "Hello world" } });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});
