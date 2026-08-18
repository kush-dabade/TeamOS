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

describe("RBAC", () => {
  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters are cleared automatically by the global
    // afterEach in tests/setup/rate-limit-cleanup-hook.ts.
  });

  it("T9: a MEMBER cannot create a project, and none is created", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const member = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects`)
      .set("Cookie", member.cookie)
      .send({
        name: "Valid Project Name",
        // A workspace member in good standing, so a 403 here can only be
        // the requireRole(["OWNER", "ADMIN"]) check in createProject - not
        // an incidental failure of the "owner must be a workspace member"
        // validation that runs after it.
        ownerId: member.userId,
      })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const projectCount = await prisma.project.count({
      where: { workspaceId: workspace.id },
    });
    expect(projectCount).toBe(0);
  });

  it("T10: a GUEST cannot create a task, and none is created", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const guest = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", guest.cookie)
      .send({ title: "Valid Task Title" })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const taskCount = await prisma.task.count({
      where: { projectId: project.id },
    });
    expect(taskCount).toBe(0);
  });

  it("T11: a GUEST can read a task in their own workspace", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const task = await createTaskDirect(workspace.id, project.id, owner.userId);

    const guest = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set("Cookie", guest.cookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(task.id);
  });

  it("T12: an ADMIN cannot change another ADMIN's role, and it stays unchanged", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const adminA = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, adminA.userId, WorkspaceRole.ADMIN);

    const adminB = await signUpTestUser(app);
    const adminBMember = await addWorkspaceMember(
      workspace.id,
      adminB.userId,
      WorkspaceRole.ADMIN,
    );

    // canManageMember() in workspace.service.ts only lets an ADMIN actor
    // manage MEMBER/GUEST targets, never a peer ADMIN - this is checked
    // before the requested role is even considered, so any valid role
    // value in the body exercises the same rejection.
    const res = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/members/${adminBMember.id}`)
      .set("Cookie", adminA.cookie)
      .send({ role: "MEMBER" })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const unchangedMember = await prisma.workspaceMember.findUniqueOrThrow({
      where: { id: adminBMember.id },
    });
    expect(unchangedMember.role).toBe(WorkspaceRole.ADMIN);
  });
});
