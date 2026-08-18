import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createSprintDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

describe("Sprint lifecycle immutability", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  describe("updateSprint", () => {
    it("rejects updates to a COMPLETED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: "COMPLETED" },
      });

      const res = await request(app)
        .patch(`/api/v1/sprints/${sprint.id}`)
        .set("Cookie", owner.cookie)
        .send({ name: "Renamed Sprint" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Completed sprints cannot be modified");

      const unchangedSprint = await prisma.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(unchangedSprint.name).toBe(sprint.name);
    });

    it("allows updates to a PLANNED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      const res = await request(app)
        .patch(`/api/v1/sprints/${sprint.id}`)
        .set("Cookie", owner.cookie)
        .send({ name: "Renamed Sprint" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Renamed Sprint");
    });

    it("allows updates to an ACTIVE sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: "ACTIVE" },
      });

      const res = await request(app)
        .patch(`/api/v1/sprints/${sprint.id}`)
        .set("Cookie", owner.cookie)
        .send({ name: "Renamed Sprint" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Renamed Sprint");
    });
  });

  describe("assignTaskToSprint", () => {
    it("rejects assigning a task to a COMPLETED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: "COMPLETED" },
      });

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Completed sprints cannot be modified");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchangedTask.sprintId).toBeNull();
    });

    it("allows assigning a task to a PLANNED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sprintId).toBe(sprint.id);
    });
  });

  describe("removeTaskFromSprint", () => {
    it("rejects removing a task from a COMPLETED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      await prisma.task.update({
        where: { id: task.id },
        data: { sprintId: sprint.id },
      });

      await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: "COMPLETED" },
      });

      const res = await request(app)
        .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Completed sprints cannot be modified");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchangedTask.sprintId).toBe(sprint.id);
    });

    it("allows removing a task from a PLANNED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      await prisma.task.update({
        where: { id: task.id },
        data: { sprintId: sprint.id },
      });

      const res = await request(app)
        .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sprintId).toBeNull();
    });
  });
});
