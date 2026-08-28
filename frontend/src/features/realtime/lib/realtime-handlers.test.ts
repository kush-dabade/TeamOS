import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activityKeys } from "@/features/activity";
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

describe("realtimeHandlers - ACTIVITY_CREATED", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  it("invalidates the entity-scoped list and the workspace-wide feed for a self-referential TASK activity", () => {
    const handler = getHandler(REALTIME_EVENTS.ACTIVITY_CREATED);

    handler(
      {
        workspaceId: "workspace-1",
        activity: { entityType: "TASK", entityId: "task-1", taskId: "task-1", projectId: null },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.list("workspace-1", "TASK", "task-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.workspaceFeed("workspace-1"),
    });
  });

  it("does not double-invalidate a self-referential PROJECT activity's own list", () => {
    const handler = getHandler(REALTIME_EVENTS.ACTIVITY_CREATED);

    handler(
      {
        workspaceId: "workspace-1",
        activity: {
          entityType: "PROJECT",
          entityId: "project-1",
          taskId: null,
          projectId: "project-1",
        },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.list("workspace-1", "PROJECT", "project-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.workspaceFeed("workspace-1"),
    });
  });

  it("also invalidates the task and project ancestry feeds for a non-self-referential activity, alongside the workspace feed", () => {
    const handler = getHandler(REALTIME_EVENTS.ACTIVITY_CREATED);

    handler(
      {
        workspaceId: "workspace-1",
        activity: {
          entityType: "COMMENT",
          entityId: "comment-1",
          taskId: "task-1",
          projectId: "project-1",
        },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.list("workspace-1", "COMMENT", "comment-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.workspaceFeed("workspace-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.list("workspace-1", "TASK", "task-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.list("workspace-1", "PROJECT", "project-1"),
    });
  });

  it("invalidates the workspace-wide feed unconditionally, even without taskId/projectId ancestry", () => {
    const handler = getHandler(REALTIME_EVENTS.ACTIVITY_CREATED);

    handler(
      {
        workspaceId: "workspace-2",
        activity: { entityType: "SPRINT", entityId: "sprint-1" },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.list("workspace-2", "SPRINT", "sprint-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: activityKeys.workspaceFeed("workspace-2"),
    });
  });
});
