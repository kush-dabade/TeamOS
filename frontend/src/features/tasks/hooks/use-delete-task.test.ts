import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppError } from "@/lib/api";
import { createTestQueryClient } from "@/test/create-test-query-client";

import { deleteTask } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import { useDeleteTask } from "./use-delete-task";

vi.mock("../api/tasks.api");

const mockDeleteTask = vi.mocked(deleteTask);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useDeleteTask", () => {
  beforeEach(() => {
    mockDeleteTask.mockReset();
  });

  it("invalidates exactly the task detail, project task list, and workspace task list caches on success", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ taskId: "task-1", projectId: "project-1" });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.workspaceLists() });
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });

  it("surfaces the error and invalidates nothing when the API call fails", async () => {
    const mockError: AppError = { type: "server", message: "Failed to delete task" };
    mockDeleteTask.mockRejectedValue(mockError);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ taskId: "task-1", projectId: "project-1" }),
    ).rejects.toEqual(mockError);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
