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

      // The COMPLETED check in updateSprint throws before the
      // $transaction that would otherwise write both the Sprint update and
      // its SPRINT_UPDATED activity - so no activity row should exist at
      // all for this rejected attempt.
      const persistedActivity = await prisma.activity.findFirst({
        where: { entityId: sprint.id, type: "SPRINT_UPDATED" },
      });
      expect(persistedActivity).toBeNull();
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

      // validateSprintCanBeModified throws before assignTaskToSprint's
      // $transaction, so no TASK_ASSIGNED_TO_SPRINT activity should exist
      // for this rejected attempt.
      const persistedActivity = await prisma.activity.findFirst({
        where: { taskId: task.id, type: "TASK_ASSIGNED_TO_SPRINT" },
      });
      expect(persistedActivity).toBeNull();
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

      // validateSprintCanBeModified throws before removeTaskFromSprint's
      // $transaction, so no TASK_REMOVED_FROM_SPRINT activity should exist
      // for this rejected attempt.
      const persistedActivity = await prisma.activity.findFirst({
        where: { taskId: task.id, type: "TASK_REMOVED_FROM_SPRINT" },
      });
      expect(persistedActivity).toBeNull();
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

  // startSprint/completeSprint reject a COMPLETED sprint via their own
  // general transition-validity guards (`status !== "PLANNED"` /
  // `status !== "ACTIVE"`), not the "Completed sprints cannot be modified"
  // message updateSprint/assignTaskToSprint/removeTaskFromSprint share -
  // those guards also happen to cover every other invalid transition (e.g.
  // starting an already-ACTIVE sprint gets the same message). Covered here
  // anyway because a COMPLETED sprint is a real instance of "cannot be
  // started" / "cannot be completed again", and neither case had explicit
  // regression coverage.
  describe("startSprint", () => {
    it("rejects starting a COMPLETED sprint", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: "COMPLETED" },
      });

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Only planned sprints can be started");

      const unchangedSprint = await prisma.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(unchangedSprint.status).toBe("COMPLETED");

      // The status guard throws before startSprint's $transaction, so no
      // SPRINT_STARTED activity should exist for this rejected attempt.
      const persistedActivity = await prisma.activity.findFirst({
        where: { entityId: sprint.id, type: "SPRINT_STARTED" },
      });
      expect(persistedActivity).toBeNull();
    });
  });

  describe("completeSprint", () => {
    it("rejects completing an already-COMPLETED sprint, without creating a second SPRINT_COMPLETED activity", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      // Legitimately reach COMPLETED through the real start/complete
      // endpoints, rather than setting status directly - this is what
      // makes the "still exactly one activity" assertion below meaningful:
      // there's a real SPRINT_COMPLETED activity on record before the
      // rejected second attempt, so seeing the count stay at one actually
      // proves the rejected request didn't create a duplicate. Asserting
      // "zero activities" (the previous version of this test) would have
      // passed even if completeSprint created an activity on every call,
      // since no legitimate completion ever happened to create one.
      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set("Cookie", owner.cookie)
        .expect(200);

      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/complete`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const activitiesAfterLegitimateCompletion = await prisma.activity.findMany({
        where: { entityId: sprint.id, type: "SPRINT_COMPLETED" },
      });
      expect(activitiesAfterLegitimateCompletion).toHaveLength(1);
      const legitimateActivityId = activitiesAfterLegitimateCompletion[0]?.id;

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/complete`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Only active sprints can be completed");

      const unchangedSprint = await prisma.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(unchangedSprint.status).toBe("COMPLETED");

      // Still exactly the one activity from the legitimate completion above
      // - same row, not merely the same count - proving the rejected
      // second attempt created no new SPRINT_COMPLETED activity.
      const activitiesAfterRejectedCompletion = await prisma.activity.findMany({
        where: { entityId: sprint.id, type: "SPRINT_COMPLETED" },
      });
      expect(activitiesAfterRejectedCompletion).toHaveLength(1);
      expect(activitiesAfterRejectedCompletion[0]?.id).toBe(legitimateActivityId);
    });
  });
});
