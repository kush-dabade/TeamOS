import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createProjectDirect,
  createSprintDirect,
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

  it("T22: a MEMBER cannot create a sprint, and none is created", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const member = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/sprints`)
      .set("Cookie", member.cookie)
      .send({ name: "Valid Sprint Name" })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const sprintCount = await prisma.sprint.count({
      where: { projectId: project.id },
    });
    expect(sprintCount).toBe(0);
  });

  describe("T23: a MEMBER cannot start or complete a sprint", () => {
    it("rejects starting a PLANNED sprint, and it remains PLANNED", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set("Cookie", member.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedSprint = await prisma.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(unchangedSprint.status).toBe("PLANNED");
    });

    it("rejects completing an ACTIVE sprint, and it remains ACTIVE", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      // Reach ACTIVE through the real, authorized start endpoint (as the
      // OWNER) rather than writing status: "ACTIVE" directly via Prisma -
      // this keeps the fixture from silently drifting out of sync with
      // whatever invariants startSprint() enforces (e.g. the one-active-
      // sprint-per-project constraint).
      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/complete`)
        .set("Cookie", member.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedSprint = await prisma.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(unchangedSprint.status).toBe("ACTIVE");
    });
  });

  describe("T24: a MEMBER cannot assign or remove a task from a sprint", () => {
    it("rejects assigning a task to a sprint, and the task stays unassigned", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", member.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchangedTask.sprintId).toBeNull();
    });

    it("rejects removing a task from a sprint, and the assignment stays intact", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const project = await createProjectDirect(workspace.id, owner.userId);
      const task = await createTaskDirect(workspace.id, project.id, owner.userId);
      const sprint = await createSprintDirect(workspace.id, project.id);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      // Assign through the real, authorized path (as the OWNER) first, so
      // the removal attempt below is rejecting an actual existing
      // assignment rather than a state this fixture merely asserted.
      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const res = await request(app)
        .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set("Cookie", member.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchangedTask.sprintId).toBe(sprint.id);
    });
  });

  describe("T25: a non-OWNER cannot rename the workspace", () => {
    it("rejects an ADMIN's rename attempt, and the name stays unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const admin = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, admin.userId, WorkspaceRole.ADMIN);

      // updateWorkspace() gates on requireRole(membership, [OWNER]) alone
      // (workspace.service.ts) - unlike every project/sprint mutation in
      // this file, ADMIN is not in the allowed list here at all.
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", admin.cookie)
        .send({ name: "Hacked Workspace Name" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedWorkspace = await prisma.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
      });
      expect(unchangedWorkspace.name).toBe(workspace.name);
    });

    it("rejects a MEMBER's rename attempt, and the name stays unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", member.cookie)
        .send({ name: "Hacked Workspace Name" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedWorkspace = await prisma.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
      });
      expect(unchangedWorkspace.name).toBe(workspace.name);
    });
  });

  it("T26: a non-OWNER (ADMIN) cannot transfer workspace ownership, and ownerId stays unchanged", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const admin = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, admin.userId, WorkspaceRole.ADMIN);

    // transferWorkspaceOwnership() requires memberId to reference an
    // existing, non-GUEST WorkspaceMember row (workspace.service.ts) - this
    // target must be eligible independently of the actor, so the test still
    // proves the actor-side rejection even though the target itself would
    // have been a valid transfer recipient.
    const targetMember = await signUpTestUser(app);
    const targetMembership = await addWorkspaceMember(
      workspace.id,
      targetMember.userId,
      WorkspaceRole.MEMBER,
    );

    // transferWorkspaceOwnership() gates on workspace.ownerId === actorId
    // directly (workspace.service.ts), not requireRole([OWNER]) - an ADMIN
    // fails this the same way a MEMBER or GUEST would, since none of them
    // are ever the row's ownerId.
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/transfer-ownership`)
      .set("Cookie", admin.cookie)
      .send({ memberId: targetMembership.id })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const unchangedWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
    });
    expect(unchangedWorkspace.ownerId).toBe(owner.userId);
  });

  describe("T27: a MEMBER cannot modify workspace members", () => {
    it("rejects changing another member's role, and it stays unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const target = await signUpTestUser(app);
      const targetMembership = await addWorkspaceMember(
        workspace.id,
        target.userId,
        WorkspaceRole.MEMBER,
      );

      // canManageMember() (workspace.service.ts) returns false for any
      // MEMBER actor regardless of target role - this is the "cannot
      // manage members at all" invariant, distinct from T12's ADMIN-vs-ADMIN
      // hierarchy check above.
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}/members/${targetMembership.id}`)
        .set("Cookie", member.cookie)
        .send({ role: "ADMIN" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedMember = await prisma.workspaceMember.findUniqueOrThrow({
        where: { id: targetMembership.id },
      });
      expect(unchangedMember.role).toBe(WorkspaceRole.MEMBER);
    });

    it("rejects removing another member, and the membership stays intact", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const member = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

      const target = await signUpTestUser(app);
      const targetMembership = await addWorkspaceMember(
        workspace.id,
        target.userId,
        WorkspaceRole.MEMBER,
      );

      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${targetMembership.id}`)
        .set("Cookie", member.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedMembership = await prisma.workspaceMember.findUniqueOrThrow({
        where: { id: targetMembership.id },
      });
      expect(unchangedMembership.userId).toBe(target.userId);
    });
  });

  it("T28: a MEMBER cannot create an invitation, and none is created", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const member = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, member.userId, WorkspaceRole.MEMBER);

    // canAssignRole() (invitation.service.ts) returns false unconditionally
    // for a MEMBER actor, for any requested role - this is the privilege-
    // ceiling check itself rejecting, not merely a coincidental validation
    // failure elsewhere in the request.
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", member.cookie)
      .send({ email: "invitee@example.com", role: "MEMBER" })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const invitationCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: workspace.id },
    });
    expect(invitationCount).toBe(0);
  });

  it("T29: an ADMIN cannot invite someone as OWNER, and no invitation is created", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const admin = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, admin.userId, WorkspaceRole.ADMIN);

    // Deviation from a naive "ADMIN privilege ceiling -> 403" assumption,
    // confirmed by reading invitation.schema.ts: createInvitationSchema
    // rejects role: "OWNER" with a Zod .refine() before the request body
    // ever reaches createInvitation()/canAssignRole() - the rejection here
    // is therefore a 400 VALIDATION_ERROR from schema parsing, not a 403
    // FORBIDDEN from the service-layer privilege-ceiling check. This is a
    // blanket rule (no actor, including OWNER, can invite an OWNER through
    // this endpoint - ownership only ever changes via transferOwnership),
    // not an ADMIN-specific rejection, but it still guards the same
    // regression this test is meant to catch: an ADMIN granting OWNER
    // access via invitation.
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", admin.cookie)
      .send({ email: "invitee@example.com", role: "OWNER" })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    const invitationCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: workspace.id },
    });
    expect(invitationCount).toBe(0);
  });
});
