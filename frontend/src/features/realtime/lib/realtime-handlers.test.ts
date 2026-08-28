import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { taskKeys } from "@/features/tasks";
import { sprintKeys } from "@/features/sprints";
import { createTestQueryClient } from "@/test/create-test-query-client";

import { realtimeHandlers, type RealtimeHandler } from "./realtime-handlers";
import { REALTIME_EVENTS, type RealtimeEvent } from "./realtime-events";

function getHandler(event: RealtimeEvent): RealtimeHandler {
  const handler = realtimeHandlers[event];
  if (!handler) {
    throw new Error(`No realtime handler registered for ${event}`);
  }
  return handler;
}

function sprintInvalidationCalls(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((call: unknown[]) => {
    const key = (call[0] as { queryKey?: unknown } | undefined)?.queryKey;
    return Array.isArray(key) && key[0] === "sprints";
  });
}

describe("realtimeHandlers - task event sprint invalidation", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  describe.each([
    ["TASK_UPDATED", REALTIME_EVENTS.TASK_UPDATED],
    ["TASK_COMPLETED", REALTIME_EVENTS.TASK_COMPLETED],
    ["TASK_DELETED", REALTIME_EVENTS.TASK_DELETED],
  ] as const)("%s", (_label, event) => {
    it("invalidates the task detail and project task-list caches", () => {
      const handler = getHandler(event);

      handler(
        {
          workspaceId: "workspace-1",
          task: { id: "task-1", projectId: "project-1", sprintId: "sprint-1" },
        },
        queryClient,
      );

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    });

    it("invalidates the task's sprint task-list cache when the payload carries a sprintId", () => {
      const handler = getHandler(event);

      handler(
        {
          workspaceId: "workspace-1",
          task: { id: "task-1", projectId: "project-1", sprintId: "sprint-1" },
        },
        queryClient,
      );

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
    });

    it("does not invalidate any sprint task-list cache when sprintId is null", () => {
      const handler = getHandler(event);

      handler(
        {
          workspaceId: "workspace-1",
          task: { id: "task-1", projectId: "project-1", sprintId: null },
        },
        queryClient,
      );

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
      expect(sprintInvalidationCalls(invalidateSpy)).toHaveLength(0);
    });

    it("does not invalidate any sprint task-list cache when sprintId is absent from the payload", () => {
      const handler = getHandler(event);

      handler(
        { workspaceId: "workspace-1", task: { id: "task-1", projectId: "project-1" } },
        queryClient,
      );

      expect(sprintInvalidationCalls(invalidateSpy)).toHaveLength(0);
    });
  });
});

describe("realtimeHandlers - sprint assignment invalidation (regression)", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  it("TASK_ASSIGNED_TO_SPRINT invalidates the task and the target sprint's task list", () => {
    const handler = getHandler(REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT);

    handler(
      { projectId: "project-1", sprintId: "sprint-1", task: { id: "task-1" } },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });

  it("TASK_ASSIGNED_TO_SPRINT also invalidates the previous sprint's task list when the task moved sprints", () => {
    const handler = getHandler(REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT);

    handler(
      {
        projectId: "project-1",
        sprintId: "sprint-2",
        task: { id: "task-1", previousSprintId: "sprint-1" },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-2") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });

  it("TASK_REMOVED_FROM_SPRINT invalidates the task and the sprint's task list only", () => {
    const handler = getHandler(REALTIME_EVENTS.TASK_REMOVED_FROM_SPRINT);

    handler(
      { projectId: "project-1", sprintId: "sprint-1", task: { id: "task-1" } },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });
});
