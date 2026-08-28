import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sprintKeys } from "@/features/sprints/lib/sprint-keys";
import { createTestQueryClient } from "@/test/create-test-query-client";

import { updateTask } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { Task } from "../types";
import { useUpdateTask } from "./use-update-task";

vi.mock("../api/tasks.api");

const mockUpdateTask = vi.mocked(updateTask);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    title: "Task title",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdById: "user-1",
    assigneeId: null,
    completedAt: null,
    deletedAt: null,
    sprintId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useUpdateTask", () => {
  beforeEach(() => {
    mockUpdateTask.mockReset();
  });

  it("invalidates the task detail, project task list, and workspace task list caches on success", async () => {
    mockUpdateTask.mockResolvedValue(buildTask({ sprintId: null }));

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ taskId: "task-1", input: { title: "Updated" } });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.workspaceLists() });
  });

  it("invalidates the task's sprint task-list cache when the updated task has a sprintId", async () => {
    mockUpdateTask.mockResolvedValue(buildTask({ sprintId: "sprint-1" }));

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ taskId: "task-1", input: { status: "DONE" } });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(4);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });

  it("does not invalidate any sprint task-list cache when the updated task has no sprintId", async () => {
    mockUpdateTask.mockResolvedValue(buildTask({ sprintId: null }));

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ taskId: "task-1", input: { title: "Updated" } });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });

    const sprintCalls = invalidateSpy.mock.calls.filter((call: unknown[]) => {
      const key = (call[0] as { queryKey?: unknown } | undefined)?.queryKey;
      return Array.isArray(key) && key[0] === "sprints";
    });
    expect(sprintCalls).toHaveLength(0);
  });
});
