import { QueryObserver, type QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activityKeys } from "@/features/activity";
import { projectKeys } from "@/features/projects";
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

  it("TASK_ASSIGNED_TO_SPRINT invalidates the task, the workspace task list and the target sprint's task list", () => {
    const handler = getHandler(REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT);

    handler(
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        sprintId: "sprint-1",
        task: { id: "task-1" },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: taskKeys.workspaceList("workspace-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.detail("task-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });

  it("TASK_ASSIGNED_TO_SPRINT also invalidates the previous sprint's task list when the task moved sprints", () => {
    const handler = getHandler(REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT);

    handler(
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        sprintId: "sprint-2",
        task: { id: "task-1", previousSprintId: "sprint-1" },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-2") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintKeys.tasks("sprint-1") });
  });

  it("TASK_REMOVED_FROM_SPRINT invalidates the task, the workspace task list and the sprint's task list only", () => {
    const handler = getHandler(REALTIME_EVENTS.TASK_REMOVED_FROM_SPRINT);

    handler(
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        sprintId: "sprint-1",
        task: { id: "task-1" },
      },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: taskKeys.workspaceList("workspace-1"),
    });
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

// Regression (audit F-04): /tasks and the dashboard's My Tasks / Workspace
// Attention panels read taskKeys.workspaceList(workspaceId), which task
// events used to leave untouched - the socket event arrived, the views
// stayed stale until a reload.
describe("realtimeHandlers - workspace-wide task list invalidation", () => {
  const ownWorkspace = "workspace-1";
  const otherWorkspace = "workspace-2";
  const task = { id: "task-1", projectId: "project-1", sprintId: null };

  const taskEvents: Array<[string, RealtimeEvent, unknown]> = [
    ["TASK_CREATED", REALTIME_EVENTS.TASK_CREATED, { workspaceId: ownWorkspace, task }],
    ["TASK_UPDATED", REALTIME_EVENTS.TASK_UPDATED, { workspaceId: ownWorkspace, task }],
    ["TASK_COMPLETED", REALTIME_EVENTS.TASK_COMPLETED, { workspaceId: ownWorkspace, task }],
    ["TASK_DELETED", REALTIME_EVENTS.TASK_DELETED, { workspaceId: ownWorkspace, task }],
    [
      "TASK_ASSIGNED_TO_SPRINT",
      REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT,
      { workspaceId: ownWorkspace, projectId: "project-1", sprintId: "sprint-1", task: { id: "task-1" } },
    ],
    [
      "TASK_REMOVED_FROM_SPRINT",
      REALTIME_EVENTS.TASK_REMOVED_FROM_SPRINT,
      { workspaceId: ownWorkspace, projectId: "project-1", sprintId: "sprint-1", task: { id: "task-1" } },
    ],
  ];

  describe.each(taskEvents)("%s", (_name, event, payload) => {
    it("invalidates only the event's own workspace task list", () => {
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(taskKeys.workspaceList(ownWorkspace), []);
      queryClient.setQueryData(taskKeys.workspaceList(otherWorkspace), []);

      getHandler(event)(payload, queryClient);

      expect(queryClient.getQueryState(taskKeys.workspaceList(ownWorkspace))?.isInvalidated).toBe(
        true,
      );
      expect(
        queryClient.getQueryState(taskKeys.workspaceList(otherWorkspace))?.isInvalidated,
      ).toBe(false);
    });
  });

  it("falls back to every cached workspace list when a payload carries no workspaceId", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(taskKeys.workspaceList(ownWorkspace), []);

    getHandler(REALTIME_EVENTS.TASK_CREATED)({ task }, queryClient);

    expect(queryClient.getQueryState(taskKeys.workspaceList(ownWorkspace))?.isInvalidated).toBe(
      true,
    );
  });

  it("ignores a payload whose workspaceId is not a string", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(taskKeys.workspaceList(ownWorkspace), []);

    getHandler(REALTIME_EVENTS.TASK_CREATED)({ workspaceId: 42, task }, queryClient);

    expect(queryClient.getQueryState(taskKeys.workspaceList(ownWorkspace))?.isInvalidated).toBe(
      false,
    );
  });

  it("refetches an active workspace task list observer, as /tasks and the dashboard use", async () => {
    const queryClient = createTestQueryClient();
    const queryFn = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "task-1" }]);
    const observer = new QueryObserver(queryClient, {
      queryKey: taskKeys.workspaceList(ownWorkspace),
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => {});

    await vi.waitFor(() =>
      expect(queryClient.getQueryState(taskKeys.workspaceList(ownWorkspace))?.status).toBe(
        "success",
      ),
    );

    getHandler(REALTIME_EVENTS.TASK_CREATED)({ workspaceId: ownWorkspace, task }, queryClient);

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(taskKeys.workspaceList(ownWorkspace))).toEqual([
        { id: "task-1" },
      ]),
    );
    expect(queryFn).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});

// Regression (audit F-25): project progress now comes from the project
// queries, so task events must refresh them as well.
describe("realtimeHandlers - project task counts", () => {
  it.each([
    REALTIME_EVENTS.TASK_CREATED,
    REALTIME_EVENTS.TASK_UPDATED,
    REALTIME_EVENTS.TASK_COMPLETED,
    REALTIME_EVENTS.TASK_DELETED,
  ])("%s invalidates the project lists and the task's project detail", (event) => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    getHandler(event)(
      { workspaceId: "workspace-1", task: { id: "task-1", projectId: "project-1", sprintId: null } },
      queryClient,
    );

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.detail("project-1") });
  });
});
