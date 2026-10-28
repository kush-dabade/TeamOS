import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppError } from "@/lib/api";
import { projectKeys } from "@/features/projects/lib/project-keys";
import { sprintKeys } from "@/features/sprints/lib/sprint-keys";
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

    await result.current.mutateAsync({ taskId: "task-1", projectId: "project-1", sprintId: null });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(5);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: taskKeys.detail("task-1"),
      refetchType: "none",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.workspaceLists() });
    // Project progress counts come from the project queries (audit F-25).
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.detail("project-1") });
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });

  // Regression (audit F-24): deleting from the task's own page refetched its
  // still-mounted detail query, which could only 404.
  it("does not refetch the deleted task's mounted detail query", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const detailFetch = vi.fn().mockResolvedValue({ id: "task-1" });
    const observer = new QueryObserver(queryClient, {
      queryKey: taskKeys.detail("task-1"),
      queryFn: detailFetch,
    });
    const unsubscribe = observer.subscribe(() => {});
    await waitFor(() => {
      expect(queryClient.getQueryState(taskKeys.detail("task-1"))?.status).toBe("success");
    });

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });
    await result.current.mutateAsync({ taskId: "task-1", projectId: "project-1", sprintId: null });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(detailFetch).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(taskKeys.detail("task-1"))?.isInvalidated).toBe(true);

    unsubscribe();
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
      result.current.mutateAsync({ taskId: "task-1", projectId: "project-1", sprintId: null }),
    ).rejects.toEqual(mockError);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // `DeleteTaskVariables` doesn't declare `sprintId` yet (Commit 2 adds it).
  // Routing the literal through an intermediate `variables` binding, instead
  // of an inline object literal, sidesteps TypeScript's excess-property check
  // so this compiles today while still exercising the real `mutateAsync` call
  // the upcoming implementation must handle.
  it("invalidates the task's sprint task-list cache when sprintId is supplied", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    const variables = { taskId: "task-1", projectId: "project-1", sprintId: "sprint-1" };
    await result.current.mutateAsync(variables);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(6);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });

  it("does not invalidate any sprint task-list cache when sprintId is null", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    const variables = { taskId: "task-1", projectId: "project-1", sprintId: null };
    await result.current.mutateAsync(variables);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(5);
    });

    const sprintCalls = invalidateSpy.mock.calls.filter((call: unknown[]) => {
      const key = (call[0] as { queryKey?: unknown } | undefined)?.queryKey;
      return Array.isArray(key) && key[0] === "sprints";
    });
    expect(sprintCalls).toHaveLength(0);
  });
});
