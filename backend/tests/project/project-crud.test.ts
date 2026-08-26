import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createProjectDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * MEMBER-cannot-create (rbac.test.ts T9) and cross-workspace read/update
 * rejection (tenant-isolation.test.ts T1, T4) are already covered - this
 * file deliberately does not re-test those. It covers the ordinary CRUD
 * happy paths and Project-specific invariants (slug generation/collision,
 * owner-must-be-member, the create date-range refine, the update "at least
 * one field" refine, archived-project rejection on update, already-archived
 * conflict on archive, and default list filtering) that have no dedicated
 * coverage anywhere else, plus the two MEMBER-authorization gaps on
 * update/archive that neither rbac.test.ts nor the Phase-4 ownership-
 * transfer/restore suites reach (those only cover MEMBER-cannot-create,
 * MEMBER-cannot-transfer-ownership, and MEMBER-cannot-restore).
 */
describe("Project CRUD", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  describe("POST /api/v1/workspaces/:workspaceId/projects", () => {
    it("creates a project owned by the actor, with a generated slug and default status", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({ name: "Marketing Launch", ownerId: owner.userId })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        workspaceId: workspace.id,
        ownerId: owner.userId,
        name: "Marketing Launch",
        slug: "marketing-launch",
        description: null,
        status: "PLANNED",
        startDate: null,
        endDate: null,
      });

      const persisted = await prisma.project.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(persisted.slug).toBe("marketing-launch");
      expect(persisted.status).toBe("PLANNED");
    });

    it("creates a project assigned to a different workspace member, with a description and a valid date range", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({
          name: "Q3 Roadmap",
          ownerId: member.userId,
          description: "Planning doc for Q3",
          startDate: "2026-07-01",
          endDate: "2026-09-30",
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        ownerId: member.userId,
        description: "Planning doc for Q3",
      });
      expect(res.body.data.startDate).toContain("2026-07-01");
      expect(res.body.data.endDate).toContain("2026-09-30");

      const persisted = await prisma.project.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(persisted.ownerId).toBe(member.userId);
    });

    it("generates a unique slug when the project name collides with an existing one", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const first = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({ name: "Duplicate Name", ownerId: owner.userId })
        .expect(201);

      const second = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({ name: "Duplicate Name", ownerId: owner.userId })
        .expect(201);

      expect(first.body.data.slug).toBe("duplicate-name");
      expect(second.body.data.slug).toBe("duplicate-name-2");

      const persistedSecond = await prisma.project.findUniqueOrThrow({
        where: { id: second.body.data.id },
      });
      expect(persistedSecond.slug).toBe("duplicate-name-2");
    });

    it("rejects an owner who is not a workspace member, and creates no project", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const outsider = await signUpTestUser(app);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({ name: "Valid Project Name", ownerId: outsider.userId })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Project owner must be a workspace member");

      const projectCount = await prisma.project.count({
        where: { workspaceId: workspace.id },
      });
      expect(projectCount).toBe(0);
    });

    it("rejects a date range where endDate precedes startDate, and creates no project", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({
          name: "Valid Project Name",
          ownerId: owner.userId,
          startDate: "2026-09-30",
          endDate: "2026-07-01",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("End date must be after start date");

      const projectCount = await prisma.project.count({
        where: { workspaceId: workspace.id },
      });
      expect(projectCount).toBe(0);
    });
  });

  describe("PATCH /api/v1/projects/:projectId", () => {
    it("updates the provided fields and leaves the rest unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId, "Original Name");

      const res = await request(app)
        .patch(`/api/v1/projects/${project.id}`)
        .set("Cookie", owner.cookie)
        .send({ name: "Renamed Project" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Renamed Project");
      // status was not part of the request, so it must be untouched.
      expect(res.body.data.status).toBe(project.status);

      const persisted = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(persisted.name).toBe("Renamed Project");
      expect(persisted.status).toBe(project.status);
    });

    it("rejects an update with no fields, and leaves the project unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const res = await request(app)
        .patch(`/api/v1/projects/${project.id}`)
        .set("Cookie", owner.cookie)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("At least one field must be provided");

      const unchanged = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(unchanged.name).toBe(project.name);
      expect(unchanged.updatedAt).toEqual(project.updatedAt);
    });

    it("rejects updating an archived project, and leaves it unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId, "Original Name");

      await prisma.project.update({
        where: { id: project.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .patch(`/api/v1/projects/${project.id}`)
        .set("Cookie", owner.cookie)
        .send({ name: "Hacked While Archived" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be updated");

      const unchanged = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(unchanged.name).toBe("Original Name");
    });

    it("rejects a MEMBER attempting to update a project, and it stays unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId, "Original Name");

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .patch(`/api/v1/projects/${project.id}`)
        .set("Cookie", member.cookie)
        .send({ name: "Hacked By Member" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchanged = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(unchanged.name).toBe("Original Name");
    });
  });

  describe("POST /api/v1/projects/:projectId/archive", () => {
    it("archives an active project", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/archive`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ARCHIVED");

      const persisted = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(persisted.status).toBe("ARCHIVED");
    });

    it("rejects archiving a project that is already archived", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      await prisma.project.update({
        where: { id: project.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/archive`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Project is already archived");
    });

    it("rejects a MEMBER attempting to archive a project, and it remains active", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .post(`/api/v1/projects/${project.id}/archive`)
        .set("Cookie", member.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchanged = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(unchanged.status).toBe(project.status);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects", () => {
    it("excludes archived projects from the default list", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const activeProject = await createProjectDirect(workspace.id, owner.userId, "Active Project");
      const archivedProject = await createProjectDirect(workspace.id, owner.userId, "Archived Project");
      await prisma.project.update({
        where: { id: archivedProject.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      const returnedIds = res.body.data.map((project: { id: string }) => project.id);
      expect(returnedIds).toEqual([activeProject.id]);
    });

    it("returns only projects matching an explicit status filter", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const plannedProject = await createProjectDirect(workspace.id, owner.userId, "Planned Project");
      const archivedProject = await createProjectDirect(workspace.id, owner.userId, "Archived Project");
      await prisma.project.update({
        where: { id: archivedProject.id },
        data: { status: "ARCHIVED" },
      });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspace.id}/projects`)
        .query({ status: "ARCHIVED" })
        .set("Cookie", owner.cookie)
        .expect(200);

      const returnedIds = res.body.data.map((project: { id: string }) => project.id);
      expect(returnedIds).toEqual([archivedProject.id]);
      expect(returnedIds).not.toContain(plannedProject.id);
    });
  });
});
