import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * GUEST-cannot-create/GUEST-can-read and all cross-workspace rejection paths
 * are already covered by security/rbac.test.ts (T10, T11) and
 * security/tenant-isolation.test.ts (T2, T3, T5, plus their "control" cases)
 * - this file deliberately does not re-test those. It covers the CRUD
 * happy paths and Task-specific validation/invariants (assignee membership,
 * the updateTaskSchema "at least one field" refine, archived-project
 * rejection, and completedAt's DONE-boundary side effect) that have no
 * dedicated coverage anywhere else, plus the two GUEST restrictions
 * (update/delete) that T10/T11 don't reach.
 */
describe("Task CRUD", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  describe("POST /api/v1/projects/:projectId/tasks", () => {
    it("creates a task with the provided title and default field values", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set("Cookie", owner.cookie)
        .send({ title: "Valid Task Title" })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        workspaceId: workspace.id,
        projectId: project.id,
        title: "Valid Task Title",
        description: null,
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: null,
        completedAt: null,
      });

      const persisted = await prisma.task.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(persisted.createdById).toBe(owner.userId);
      expect(persisted.title).toBe("Valid Task Title");
    });

    it("creates a task with an assignee, priority, description, and due date", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const assignee = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, assignee.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set("Cookie", owner.cookie)
        .send({
          title: "Fully Specified Task",
          description: "Some description",
          priority: "HIGH",
          dueDate: "2026-09-01",
          assigneeId: assignee.userId,
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        title: "Fully Specified Task",
        description: "Some description",
        priority: "HIGH",
        assigneeId: assignee.userId,
      });
      expect(res.body.data.dueDate).toContain("2026-09-01");

      const persisted = await prisma.task.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(persisted.assigneeId).toBe(assignee.userId);
      expect(persisted.priority).toBe("HIGH");
    });

    it("rejects an assignee who is not a workspace member, and creates no task", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const outsider = await signUpTestUser(app);

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set("Cookie", owner.cookie)
        .send({ title: "Valid Task Title", assigneeId: outsider.userId })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Assignee must be a workspace member");

      const taskCount = await prisma.task.count({
        where: { projectId: project.id },
      });
      expect(taskCount).toBe(0);
    });

    it("rejects creating a task in an archived project, and creates no task", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      await prisma.project.update({
        where: { id: project.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set("Cookie", owner.cookie)
        .send({ title: "Valid Task Title" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be modified");

      const taskCount = await prisma.task.count({
        where: { projectId: project.id },
      });
      expect(taskCount).toBe(0);
    });
  });

  describe("GET /api/v1/tasks/:taskId", () => {
    it("returns the persisted task matching its stored data", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const assignee = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, assignee.userId, WorkspaceRole.MEMBER);

      const task = await createTaskDirect(
        workspace.id,
        project.id,
        owner.userId,
        "Readable Task",
        assignee.userId,
      );

      const res = await request(app)
        .get(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: task.id,
        workspaceId: workspace.id,
        projectId: project.id,
        title: "Readable Task",
        status: task.status,
        assigneeId: assignee.userId,
        createdById: owner.userId,
      });
    });
  });

  describe("PATCH /api/v1/tasks/:taskId", () => {
    it("updates the provided fields and leaves the rest unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId, "Original Title");

      const res = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .send({ title: "Updated Title", priority: "URGENT" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Updated Title");
      expect(res.body.data.priority).toBe("URGENT");
      // status was not part of the request, so it must be untouched.
      expect(res.body.data.status).toBe(task.status);

      const persisted = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(persisted.title).toBe("Updated Title");
      expect(persisted.priority).toBe("URGENT");
    });

    it("rejects an update with no fields, and leaves the task unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      const res = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("At least one field must be provided");

      const unchanged = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.title).toBe(task.title);
      expect(unchanged.updatedAt).toEqual(task.updatedAt);
    });

    it("rejects reassigning to a user who is not a workspace member, and leaves the task unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      const outsider = await signUpTestUser(app);

      const res = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .send({ assigneeId: outsider.userId })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Assignee must be a workspace member");

      const unchanged = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.assigneeId).toBeNull();
    });

    it("rejects updating a task in an archived project, and leaves it unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId, "Original Title");

      await prisma.project.update({
        where: { id: project.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .send({ title: "Hacked While Archived" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be modified");

      const unchanged = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.title).toBe("Original Title");
    });

    it("a GUEST cannot update a task, and it stays unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId, "Original Title");

      const guest = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

      const res = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set("Cookie", guest.cookie)
        .send({ title: "Hacked By Guest" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchanged = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.title).toBe("Original Title");
    });

    describe("status transitions", () => {
      it("sets completedAt when a task transitions to DONE", async () => {
        const owner = await signUpTestUser(app);
        const { workspace } = await createWorkspaceWithMember(owner.userId);
        const project = await createProjectDirect(workspace.id, owner.userId);
        const task = await createTaskDirect(workspace.id, project.id, owner.userId);

        expect(task.completedAt).toBeNull();

        const res = await request(app)
          .patch(`/api/v1/tasks/${task.id}`)
          .set("Cookie", owner.cookie)
          .send({ status: "DONE" })
          .expect(200);

        expect(res.body.data.status).toBe("DONE");
        expect(res.body.data.completedAt).not.toBeNull();

        const persisted = await prisma.task.findUniqueOrThrow({
          where: { id: task.id },
        });
        expect(persisted.status).toBe("DONE");
        expect(persisted.completedAt).not.toBeNull();
      });

      it("clears completedAt when a task transitions away from DONE, and allows a direct non-adjacent status change", async () => {
        const owner = await signUpTestUser(app);
        const { workspace } = await createWorkspaceWithMember(owner.userId);
        const project = await createProjectDirect(workspace.id, owner.userId);
        const task = await createTaskDirect(workspace.id, project.id, owner.userId);

        await request(app)
          .patch(`/api/v1/tasks/${task.id}`)
          .set("Cookie", owner.cookie)
          .send({ status: "DONE" })
          .expect(200);

        // TaskStatus has no enforced transition graph - going straight from
        // DONE to REVIEW (skipping TODO/IN_PROGRESS entirely) is expected to
        // succeed exactly like any other status change.
        const res = await request(app)
          .patch(`/api/v1/tasks/${task.id}`)
          .set("Cookie", owner.cookie)
          .send({ status: "REVIEW" })
          .expect(200);

        expect(res.body.data.status).toBe("REVIEW");
        expect(res.body.data.completedAt).toBeNull();

        const persisted = await prisma.task.findUniqueOrThrow({
          where: { id: task.id },
        });
        expect(persisted.status).toBe("REVIEW");
        expect(persisted.completedAt).toBeNull();
      });
    });
  });

  describe("DELETE /api/v1/tasks/:taskId", () => {
    it("soft-deletes the task, which then becomes unretrievable", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      const res = await request(app)
        .delete(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);

      const persisted = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(persisted.deletedAt).not.toBeNull();

      const getAfterDelete = await request(app)
        .get(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(404);

      expect(getAfterDelete.body.success).toBe(false);
      expect(getAfterDelete.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects deleting a task in an archived project, and it remains active", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      await prisma.project.update({
        where: { id: project.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .delete(`/api/v1/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be modified");

      const unchanged = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.deletedAt).toBeNull();
    });

    it("a GUEST cannot delete a task, and it remains active", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);

      const guest = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

      const res = await request(app)
        .delete(`/api/v1/tasks/${task.id}`)
        .set("Cookie", guest.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchanged = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.deletedAt).toBeNull();
    });
  });
});
