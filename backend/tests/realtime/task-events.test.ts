import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createSprintDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  trackEvent,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

interface TaskEventPayload {
  workspaceId: string;
  task: {
    id: string;
    title?: string;
    status?: string;
  };
}

interface SprintTaskEventPayload {
  workspaceId: string;
  projectId: string;
  sprintId: string;
  task: {
    id: string;
    sprintId: string | null;
    previousSprintId?: string;
  };
}

/**
 * Connects a test socket and proves it has joined its workspace room before
 * returning, using an unrelated sentinel event (PROJECT_CREATED - not one of
 * the six events this file locks down) - the same "confirm-joined" pattern
 * comment-crud.test.ts's "create - realtime" suite already uses. This is the
 * only direct emitToWorkspace() call in this file: it exists solely to close
 * the connect-vs-room-join race waitForEventWithRetries's own doc comment
 * describes, never to substitute for any task/sprint-task event under test -
 * every event asserted below is observed only after a real HTTP mutation.
 */
async function connectAndConfirmJoined(baseUrl: string, cookie: string, workspaceId: string) {
  const socket = await connectTestSocket(baseUrl, cookie);

  await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_CREATED, () =>
    emitToWorkspace(workspaceId, REALTIME_EVENTS.PROJECT_CREATED, {
      marker: "confirm-joined",
    }),
  );

  return socket;
}

describe("task realtime event contracts", () => {
  let testServer: TestServer;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await testServer.close();
  });

  afterEach(async () => {
    openSockets.forEach((socket) => socket.disconnect());
    openSockets.length = 0;
    await resetDatabase();
  });

  it("emits TASK_CREATED with the new task's identity and fields when a task is created", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const eventPromise = waitForEvent<TaskEventPayload>(socket, REALTIME_EVENTS.TASK_CREATED);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({ title: "Realtime created task" })
      .expect(201);

    const payload = await eventPromise;

    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.task.id).toBe(res.body.data.id);
    expect(payload.task.title).toBe("Realtime created task");
    expect(payload.task.status).toBe("TODO");
  });

  it("emits TASK_UPDATED (not TASK_COMPLETED) with the changed field when a task is updated without transitioning to DONE", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const updatedPromise = waitForEvent<TaskEventPayload>(socket, REALTIME_EVENTS.TASK_UPDATED);
    const completedTracker = trackEvent(socket, REALTIME_EVENTS.TASK_COMPLETED);

    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .send({ title: "Renamed via realtime test" })
      .expect(200);

    const payload = await updatedPromise;

    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.task.id).toBe(task.id);
    expect(payload.task.title).toBe("Renamed via realtime test");
    expect(completedTracker.wasReceived()).toBe(false);
    completedTracker.stop();
  });

  it("emits TASK_COMPLETED (not TASK_UPDATED) when a task transitions from a non-DONE status to DONE", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const completedPromise = waitForEvent<TaskEventPayload>(
      socket,
      REALTIME_EVENTS.TASK_COMPLETED,
    );
    const updatedTracker = trackEvent(socket, REALTIME_EVENTS.TASK_UPDATED);

    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .send({ status: "DONE" })
      .expect(200);

    const payload = await completedPromise;

    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.task.id).toBe(task.id);
    expect(payload.task.status).toBe("DONE");
    expect(updatedTracker.wasReceived()).toBe(false);
    updatedTracker.stop();
  });

  it("emits TASK_DELETED with stable identity fields when a task is deleted", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const eventPromise = waitForEvent<TaskEventPayload>(socket, REALTIME_EVENTS.TASK_DELETED);

    await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const payload = await eventPromise;

    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.task).toBeDefined();
    expect(payload.task.id).toBe(task.id);
    // Known pre-existing bug, not fixed here: deleteTask (task.service.ts)
    // emits toTaskResponse() of the task row it fetched BEFORE the soft
    // delete, so payload.task.deletedAt is always null even though the row
    // was just soft-deleted. Deliberately not asserted - pinning that value
    // would encode the bug as the desired contract.
  });

  it("emits TASK_ASSIGNED_TO_SPRINT with the target sprint when a task is assigned to a sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const eventPromise = waitForEvent<SprintTaskEventPayload>(
      socket,
      REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT,
    );

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const payload = await eventPromise;

    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.projectId).toBe(project.id);
    expect(payload.sprintId).toBe(sprint.id);
    expect(payload.task.id).toBe(task.id);
    expect(payload.task.sprintId).toBe(sprint.id);
  });

  it("emits TASK_REMOVED_FROM_SPRINT with sprintId null when a task is removed from a sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id);

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const eventPromise = waitForEvent<SprintTaskEventPayload>(
      socket,
      REALTIME_EVENTS.TASK_REMOVED_FROM_SPRINT,
    );

    await request(app)
      .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const payload = await eventPromise;

    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.projectId).toBe(project.id);
    expect(payload.sprintId).toBe(sprint.id);
    expect(payload.task.id).toBe(task.id);
    expect(payload.task.sprintId).toBeNull();
  });

  // Optional stretch (per the locked Phase 3 PR 4 scope): reassigning a task
  // that's already in a sprint is a distinct branch in assignTaskToSprint
  // (sprint-task.service.ts's `previousSprint` lookup), which only the
  // required test above doesn't exercise - it assigns from no sprint.
  it("includes previousSprintId in TASK_ASSIGNED_TO_SPRINT when reassigning a task already in a different sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const firstSprint = await createSprintDirect(workspace.id, project.id);
    const secondSprint = await createSprintDirect(workspace.id, project.id);

    await request(app)
      .post(`/api/v1/sprints/${firstSprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const socket = await connectAndConfirmJoined(testServer.baseUrl, owner.cookie, workspace.id);
    openSockets.push(socket);

    const eventPromise = waitForEvent<SprintTaskEventPayload>(
      socket,
      REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT,
    );

    await request(app)
      .post(`/api/v1/sprints/${secondSprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const payload = await eventPromise;

    expect(payload.sprintId).toBe(secondSprint.id);
    expect(payload.task.sprintId).toBe(secondSprint.id);
    expect(payload.task.previousSprintId).toBe(firstSprint.id);
  });
});
