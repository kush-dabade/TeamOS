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

/**
 * Every scenario below follows the same shape: an "attacker" who is a
 * legitimate OWNER of their own workspace, and a "target" workspace the
 * attacker has no membership in at all. The attacker only ever supplies
 * IDs belonging to the target workspace's resources - never a session
 * from within the target workspace - so a passing test proves the
 * membership check (not merely a role check) is what's rejecting the
 * request.
 */
async function createCrossWorkspaceScenario() {
  const attacker = await signUpTestUser(app);
  const { workspace: attackerWorkspace } = await createWorkspaceWithMember(
    attacker.userId,
  );

  const targetOwner = await signUpTestUser(app);
  const { workspace: targetWorkspace } = await createWorkspaceWithMember(
    targetOwner.userId,
  );

  const targetProject = await createProjectDirect(
    targetWorkspace.id,
    targetOwner.userId,
    "Target Workspace Project",
  );

  const targetTask = await createTaskDirect(
    targetWorkspace.id,
    targetProject.id,
    targetOwner.userId,
    "Target Workspace Task",
  );

  return {
    attacker,
    attackerWorkspace,
    targetOwner,
    targetWorkspace,
    targetProject,
    targetTask,
  };
}

describe("tenant isolation", () => {
  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters are cleared automatically by the global
    // afterEach in tests/setup/rate-limit-cleanup-hook.ts.
  });

  describe("cross-workspace read", () => {
    it("T1: rejects reading another workspace's project by guessed ID", async () => {
      const { attacker, targetProject } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/projects/${targetProject.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("T2: rejects reading another workspace's task by guessed ID", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("cross-workspace mutation", () => {
    it("T3: rejects updating another workspace's task, and leaves it unchanged", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .patch(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", attacker.cookie)
        .send({ title: "Hacked by attacker" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(unchangedTask.title).toBe("Target Workspace Task");
    });

    it("T4: rejects updating another workspace's project, and leaves it unchanged", async () => {
      const { attacker, targetProject } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .patch(`/api/v1/projects/${targetProject.id}`)
        .set("Cookie", attacker.cookie)
        .send({ name: "Hacked Project Name" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedProject = await prisma.project.findUniqueOrThrow({
        where: { id: targetProject.id },
      });
      expect(unchangedProject.name).toBe("Target Workspace Project");
    });
  });

  describe("cross-workspace deletion", () => {
    it("T5: rejects deleting another workspace's task, and leaves it undeleted", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .delete(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(unchangedTask.deletedAt).toBeNull();
    });
  });

  describe("cross-workspace nested resource access", () => {
    it("T6: rejects commenting on another workspace's task, and creates no comment", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .post(`/api/v1/tasks/${targetTask.id}/comments`)
        .set("Cookie", attacker.cookie)
        .send({ content: "Malicious comment from an outsider" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const commentCount = await prisma.comment.count({
        where: { taskId: targetTask.id },
      });
      expect(commentCount).toBe(0);
    });

    it("T7: rejects assigning another workspace's task to the attacker's own sprint", async () => {
      const { attacker, attackerWorkspace, targetTask } =
        await createCrossWorkspaceScenario();

      // The attacker is a legitimate OWNER of their own workspace, so this
      // sprint is entirely valid - the attack is supplying a taskId that
      // belongs to a different workspace entirely.
      const attackerProject = await createProjectDirect(
        attackerWorkspace.id,
        attacker.userId,
        "Attacker Workspace Project",
      );
      const attackerSprint = await createSprintDirect(
        attackerWorkspace.id,
        attackerProject.id,
      );

      const res = await request(app)
        .post(
          `/api/v1/sprints/${attackerSprint.id}/tasks/${targetTask.id}`,
        )
        .set("Cookie", attacker.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe(
        "Task and sprint must belong to the same workspace",
      );

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(unchangedTask.sprintId).toBeNull();
    });

    it("T8: rejects assigning a same-workspace task from a different project to a sprint", async () => {
      const attacker = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(attacker.userId);

      // Both projects live in the same workspace the attacker legitimately
      // owns - the attack is crossing a project boundary, not a workspace
      // boundary, so this must be rejected by the project-match check
      // specifically (task.projectId !== sprint.projectId), not the
      // workspace-match check that T7 already exercises.
      const sprintProject = await createProjectDirect(
        workspace.id,
        attacker.userId,
        "Sprint's Project",
      );
      const otherProject = await createProjectDirect(
        workspace.id,
        attacker.userId,
        "Other Project",
      );

      const sprint = await createSprintDirect(workspace.id, sprintProject.id);
      const otherProjectTask = await createTaskDirect(
        workspace.id,
        otherProject.id,
        attacker.userId,
      );

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks/${otherProjectTask.id}`)
        .set("Cookie", attacker.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: otherProjectTask.id },
      });
      expect(unchangedTask.sprintId).toBeNull();
    });
  });

  describe("same-workspace access (negative controls)", () => {
    // T1-T8 above only prove something rejects cross-workspace access - on
    // their own they'd pass identically if every request were rejected
    // unconditionally. These controls prove the opposite case still works,
    // so a 403/400 above is meaningful rather than a blanket deny.

    it("control: a legitimate workspace member can read their own project", async () => {
      const { targetOwner, targetProject } =
        await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/projects/${targetProject.id}`)
        .set("Cookie", targetOwner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetProject.id);
    });

    it("control: a legitimate workspace member can read their own task", async () => {
      const { targetOwner, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", targetOwner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetTask.id);
    });

    it("control: a legitimate workspace member can update their own task", async () => {
      const { targetOwner, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .patch(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", targetOwner.cookie)
        .send({ title: "Legitimately updated title" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Legitimately updated title");

      const updatedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(updatedTask.title).toBe("Legitimately updated title");
    });
  });
});
