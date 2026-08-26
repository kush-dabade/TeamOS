import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppError } from "@/lib/api";
import { createTestQueryClient } from "@/test/create-test-query-client";

import { removeWorkspaceMember } from "../api/workspaces.api";
import { workspaceKeys } from "../lib/workspace-keys";
import { useRemoveWorkspaceMember } from "./use-remove-workspace-member";

vi.mock("../api/workspaces.api");

const mockRemoveWorkspaceMember = vi.mocked(removeWorkspaceMember);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useRemoveWorkspaceMember", () => {
  beforeEach(() => {
    mockRemoveWorkspaceMember.mockReset();
  });

  it("invalidates the workspace members cache with refetchType 'all' on success", async () => {
    mockRemoveWorkspaceMember.mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRemoveWorkspaceMember("workspace-1"), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync("member-1");

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: workspaceKeys.members("workspace-1"),
      refetchType: "all",
    });
    expect(mockRemoveWorkspaceMember).toHaveBeenCalledWith("workspace-1", "member-1");
  });

  it("surfaces the error and invalidates nothing when the API call fails", async () => {
    const mockError: AppError = { type: "server", message: "Failed to remove member" };
    mockRemoveWorkspaceMember.mockRejectedValue(mockError);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRemoveWorkspaceMember("workspace-1"), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync("member-1")).rejects.toEqual(mockError);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
