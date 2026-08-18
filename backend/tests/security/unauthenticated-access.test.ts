import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createSprintDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

describe("unauthenticated access", () => {
  let workspaceId: string;
  let projectId: string;
  let taskId: string;
  let sprintId: string;

  beforeEach(async () => {
    // The owning user's session cookie is intentionally discarded here -
    // these fixtures only exist to satisfy Prisma foreign keys
    // (Workspace.ownerId, Task.createdById, etc.) with a real User row, not
    // to authenticate anything. Every request below is sent with no
    // Cookie/Authorization header at all, proving requireAuth rejects it
    // before the resource's own existence or the actor's membership is
    // ever considered.
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id);

    workspaceId = workspace.id;
    projectId = project.id;
    taskId = task.id;
    sprintId = sprint.id;
  });

  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters are cleared automatically by the global
    // afterEach in tests/setup/rate-limit-cleanup-hook.ts.
  });

  it.each([
    [
      "workspace: GET /workspaces/:workspaceId",
      () => request(app).get(`/api/v1/workspaces/${workspaceId}`),
    ],
    [
      "workspace members: GET /workspaces/:workspaceId/members",
      () => request(app).get(`/api/v1/workspaces/${workspaceId}/members`),
    ],
    [
      "project: GET /projects/:projectId",
      () => request(app).get(`/api/v1/projects/${projectId}`),
    ],
    [
      "task: GET /tasks/:taskId",
      () => request(app).get(`/api/v1/tasks/${taskId}`),
    ],
    [
      "comment: POST /tasks/:taskId/comments",
      () =>
        request(app)
          .post(`/api/v1/tasks/${taskId}/comments`)
          .send({ content: "Valid comment content" }),
    ],
    [
      "sprint: GET /sprints/:sprintId",
      () => request(app).get(`/api/v1/sprints/${sprintId}`),
    ],
  ])("%s -> 401 with no session", async (_name, buildRequest) => {
    const res = await buildRequest().expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });
});
