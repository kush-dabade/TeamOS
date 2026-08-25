import { afterEach, describe, expect, it } from "vitest";
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

// Regression coverage for P4-SPRINT-SERIALIZE: sprint-task.service.ts used to
// return raw Prisma Task rows on these three REST paths, leaking internal
// fields such as deletedAt instead of going through toTaskResponse() like
// every other Task endpoint.
describe("Sprint Task REST response serialization", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("assign: serializes the response through toTaskResponse", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id);

    const res = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data).not.toHaveProperty("deletedAt");

    expect(res.body.data).toMatchObject({
      id: task.id,
      workspaceId: workspace.id,
      projectId: project.id,
      title: task.title,
      status: "TODO",
      priority: "MEDIUM",
      sprintId: sprint.id,
    });
  });

  it("remove: serializes the response through toTaskResponse", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id);

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const res = await request(app)
      .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data).not.toHaveProperty("deletedAt");

    expect(res.body.data).toMatchObject({
      id: task.id,
      workspaceId: workspace.id,
      projectId: project.id,
      title: task.title,
      status: "TODO",
      priority: "MEDIUM",
      sprintId: null,
    });
  });

  it("list: serializes every returned task through toTaskResponse", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id);

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const res = await request(app)
      .get(`/api/v1/sprints/${sprint.id}/tasks`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).not.toHaveProperty("deletedAt");

    expect(res.body.data[0]).toMatchObject({
      id: task.id,
      workspaceId: workspace.id,
      projectId: project.id,
      title: task.title,
      status: "TODO",
      priority: "MEDIUM",
      sprintId: sprint.id,
    });
  });
});
