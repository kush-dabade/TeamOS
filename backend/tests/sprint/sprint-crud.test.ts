import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createSprintDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * MEMBER-cannot-create-sprint (rbac.test.ts T22) and cross-workspace
 * read/update rejection (tenant-isolation.test.ts T17) are already covered
 * - this file deliberately does not re-test those. The one-ACTIVE-sprint
 * invariant (sprint-active-invariant.test.ts) and COMPLETED-immutability
 * (sprint-lifecycle-immutability.test.ts) are also already thoroughly
 * covered and are not duplicated here.
 *
 * This file is scoped narrowly to Sprint creation: the happy path, the
 * createSprintSchema endDate>=startDate refine, and the service-level
 * duplicate-name-within-project check (case-insensitive). Full Sprint CRUD
 * (update, start, complete) is intentionally out of scope for this commit.
 */
describe("Sprint creation", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("creates a planned sprint with just a name", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({ name: "Sprint Alpha" })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      workspaceId: workspace.id,
      projectId: project.id,
      name: "Sprint Alpha",
      goal: null,
      status: "PLANNED",
      startDate: null,
      endDate: null,
    });

    const persisted = await prisma.sprint.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(persisted.name).toBe("Sprint Alpha");
    expect(persisted.status).toBe("PLANNED");
  });

  it("creates a sprint with a goal and a valid date range", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({
        name: "Sprint Beta",
        goal: "Ship the beta release",
        startDate: "2026-09-01",
        endDate: "2026-09-14",
      })
      .expect(201);

    expect(res.body.data).toMatchObject({
      name: "Sprint Beta",
      goal: "Ship the beta release",
    });
    expect(res.body.data.startDate).toContain("2026-09-01");
    expect(res.body.data.endDate).toContain("2026-09-14");

    const persisted = await prisma.sprint.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(persisted.goal).toBe("Ship the beta release");
  });

  it("rejects a date range where endDate precedes startDate, and creates no sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({
        name: "Sprint Invalid Range",
        startDate: "2026-09-14",
        endDate: "2026-09-01",
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("End date must be after start date");

    const sprintCount = await prisma.sprint.count({
      where: { projectId: project.id },
    });
    expect(sprintCount).toBe(0);
  });

  it("rejects a duplicate sprint name within the same project, and creates no sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    await createSprintDirect(workspace.id, project.id, "Sprint One");

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({ name: "Sprint One" })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe(
      "A sprint with this name already exists in the project",
    );

    const sprintCount = await prisma.sprint.count({
      where: { projectId: project.id },
    });
    expect(sprintCount).toBe(1);
  });

  it("rejects a duplicate sprint name that differs only by case, and creates no sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    await createSprintDirect(workspace.id, project.id, "Sprint One");

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({ name: "sprint one" })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe(
      "A sprint with this name already exists in the project",
    );

    const sprintCount = await prisma.sprint.count({
      where: { projectId: project.id },
    });
    expect(sprintCount).toBe(1);
  });

  it("allows the same sprint name in a different project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const projectA = await createProjectDirect(workspace.id, owner.userId, "Project A");
    const projectB = await createProjectDirect(workspace.id, owner.userId, "Project B");

    await createSprintDirect(workspace.id, projectA.id, "Shared Sprint Name");

    const res = await request(app)
      .post(`/api/v1/projects/${projectB.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({ name: "Shared Sprint Name" })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.projectId).toBe(projectB.id);
  });
});
