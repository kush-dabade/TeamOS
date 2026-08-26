import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createInvitationDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * Cancellation (cancel-invitation.test.ts), MEMBER-cannot-create and
 * ADMIN-cannot-invite-OWNER (rbac.test.ts T28/T29), cross-workspace
 * cancel/resend rejection (tenant-isolation.test.ts T20), and the
 * invitation rate-limit buckets (rate-limit.test.ts) are already covered -
 * this file deliberately does not re-test those. It covers the rest of the
 * lifecycle that has zero coverage anywhere: create's duplicate-pending and
 * already-a-member guards, accept (by id and by token), decline (by id and
 * by token), the wrong-email/expired/non-pending eligibility checks, the
 * transactional double-accept race guard, and resend's happy path.
 */
describe("Invitation lifecycle", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  describe("create", () => {
    it("creates a pending invitation for a new email", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: "New.Invitee@example.com", role: "MEMBER" })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        workspaceId: workspace.id,
        email: "new.invitee@example.com",
        role: "MEMBER",
        invitedById: owner.userId,
        status: "PENDING",
      });
      expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const persisted = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(persisted.email).toBe("new.invitee@example.com");
      expect(persisted.status).toBe("PENDING");
    });

    it("rejects a duplicate pending invitation for the same email", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: "duplicate@example.com", role: "MEMBER" })
        .expect(201);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: "duplicate@example.com", role: "MEMBER" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Pending invitation already exists");

      const invitationCount = await prisma.workspaceInvitation.count({
        where: { workspaceId: workspace.id, email: "duplicate@example.com" },
      });
      expect(invitationCount).toBe(1);
    });

    it("rejects inviting an existing workspace member", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const existingMember = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, existingMember.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: existingMember.email, role: "MEMBER" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("User is already a member of this workspace");

      const invitationCount = await prisma.workspaceInvitation.count({
        where: { workspaceId: workspace.id, email: existingMember.email },
      });
      expect(invitationCount).toBe(0);
    });
  });

  describe("accept", () => {
    it("accepts an invitation by ID and creates a workspace membership with the invited role", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.ADMIN,
        invitee.email,
      );

      const res = await request(app)
        .post(`/api/v1/invitations/${invitation.id}/accept`)
        .set("Cookie", invitee.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ACCEPTED");

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persistedInvitation.status).toBe("ACCEPTED");

      const membership = await prisma.workspaceMember.findUniqueOrThrow({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId },
        },
      });
      expect(membership.role).toBe("ADMIN");
    });

    it("accepts an invitation by token", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      const res = await request(app)
        .post(`/api/v1/invitations/token/${invitation.token}/accept`)
        .set("Cookie", invitee.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ACCEPTED");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId },
        },
      });
      expect(membership?.role).toBe("MEMBER");
    });

    it("rejects acceptance by the wrong email, and creates no membership", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      const outsider = await signUpTestUser(app);

      const res = await request(app)
        .post(`/api/v1/invitations/${invitation.id}/accept`)
        .set("Cookie", outsider.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persistedInvitation.status).toBe("PENDING");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: outsider.userId },
        },
      });
      expect(membership).toBeNull();
    });

    it("rejects an expired invitation, and creates no membership", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(app)
        .post(`/api/v1/invitations/${invitation.id}/accept`)
        .set("Cookie", invitee.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Invitation has expired");

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      // The audit's finding holds: expiry is a computed expiresAt check, not
      // a written InvitationStatus.EXPIRED - status stays PENDING even
      // though the invitation is no longer acceptable.
      expect(persistedInvitation.status).toBe("PENDING");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId },
        },
      });
      expect(membership).toBeNull();
    });

    it("rejects acceptance of a non-pending invitation, and creates no membership", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "DECLINED" },
      });

      const res = await request(app)
        .post(`/api/v1/invitations/${invitation.id}/accept`)
        .set("Cookie", invitee.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Invitation is no longer pending");

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persistedInvitation.status).toBe("DECLINED");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId },
        },
      });
      expect(membership).toBeNull();
    });
  });

  describe("double-accept race", () => {
    it("allows exactly one of two concurrent acceptance attempts to succeed", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      // Fired concurrently against the real running app / real Postgres
      // connection pool - not a mocked transaction - so both requests'
      // status=PENDING compare-and-set updates genuinely race each other.
      // Same pattern as sprint-active-invariant.test.ts's concurrent
      // activation test and restore.test.ts's concurrent restore test:
      // classify by observed HTTP outcome, then verify the database ends up
      // in exactly the state a single winner implies.
      const [responseA, responseB] = await Promise.all([
        request(app)
          .post(`/api/v1/invitations/${invitation.id}/accept`)
          .set("Cookie", invitee.cookie),
        request(app)
          .post(`/api/v1/invitations/${invitation.id}/accept`)
          .set("Cookie", invitee.cookie),
      ]);

      const responses = [responseA, responseB];
      const winners = responses.filter((r) => r.status === 200);
      const losers = responses.filter((r) => r.status === 400);

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      expect(winners[0]?.body.success).toBe(true);
      expect(winners[0]?.body.data.status).toBe("ACCEPTED");

      // acceptResolvedInvitation's "already a member" check
      // (findWorkspaceMembership) runs *before* the transactional
      // status=PENDING compare-and-set, so it is not itself part of the
      // atomic guard. Depending on exactly how the two requests interleave,
      // the loser is rejected by whichever check it reaches first: the
      // pre-transaction membership check (if it runs after the winner's
      // transaction has already committed the membership row) or the
      // in-transaction compare-and-set (if it runs before). Both are
      // legitimate, correctly-shaped 400s reflecting the same underlying
      // race - the loser's specific wording is a genuinely non-deterministic
      // implementation detail, verified empirically across repeated runs of
      // this exact test. The invariant this test protects (exactly one
      // success, exactly one membership) is deterministic and asserted
      // below without weakening.
      expect(losers[0]?.body.success).toBe(false);
      expect(losers[0]?.body.error.code).toBe("VALIDATION_ERROR");
      expect([
        "Invitation is no longer pending",
        "You are already a member of this workspace",
      ]).toContain(losers[0]?.body.error.message);

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persistedInvitation.status).toBe("ACCEPTED");

      const memberships = await prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.id, userId: invitee.userId },
      });
      expect(memberships).toHaveLength(1);
    });
  });

  describe("decline", () => {
    it("declines an invitation by ID, and creates no membership", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      const res = await request(app)
        .post(`/api/v1/invitations/${invitation.id}/decline`)
        .set("Cookie", invitee.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DECLINED");

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persistedInvitation.status).toBe("DECLINED");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId },
        },
      });
      expect(membership).toBeNull();
    });

    it("declines an invitation by token", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      const res = await request(app)
        .post(`/api/v1/invitations/token/${invitation.token}/decline`)
        .set("Cookie", invitee.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DECLINED");
    });

    it("rejects decline by the wrong email, and leaves the invitation pending", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitee = await signUpTestUser(app);
      const invitation = await createInvitationDirect(
        workspace.id,
        owner.userId,
        WorkspaceRole.MEMBER,
        invitee.email,
      );

      const outsider = await signUpTestUser(app);

      const res = await request(app)
        .post(`/api/v1/invitations/${invitation.id}/decline`)
        .set("Cookie", outsider.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const persistedInvitation = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persistedInvitation.status).toBe("PENDING");
    });
  });

  describe("resend", () => {
    it("resends a pending invitation, extending its expiration", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitation = await createInvitationDirect(workspace.id, owner.userId);

      // Force a near-term expiry so the resend's "extend by 7 days" effect
      // is unambiguous, rather than relying on a sub-millisecond difference
      // between two nearly-simultaneous +7-day computations.
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(Date.now() + 1000) },
      });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations/${invitation.id}/resend`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      const sixDaysFromNow = Date.now() + 6 * 24 * 60 * 60 * 1000;
      expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(sixDaysFromNow);

      const persisted = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persisted.expiresAt.getTime()).toBeGreaterThan(sixDaysFromNow);
      expect(persisted.token).toBe(invitation.token);
    });

    it("rejects resending a non-pending invitation, and leaves its expiration unchanged", async () => {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const invitation = await createInvitationDirect(workspace.id, owner.userId);

      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations/${invitation.id}/resend`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Invitation is no longer pending");

      const persisted = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(persisted.expiresAt.getTime()).toBe(invitation.expiresAt.getTime());
    });
  });
});
