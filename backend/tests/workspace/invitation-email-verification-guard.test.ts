import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createInvitationDirect,
  createWorkspaceWithMember,
  signUpTestUser,
  type AuthenticatedTestUser,
} from "../setup/fixtures.js";

/**
 * The email-matching invitation operations (list, accept by id, decline by
 * id) only trust the session's email once it's verified - see
 * invitation.service.ts's assertEmailVerifiedForEmailMatch. With
 * REQUIRE_EMAIL_VERIFICATION=false an attacker can register a victim's
 * address and hold a real session for it; this suite reproduces that state
 * by flipping a signed-in user back to unverified, which getSession reads
 * straight from the database on the next request.
 *
 * The by-token operations stay open to unverified accounts, since only the
 * invited mailbox ever receives the token. Verified users' behavior on every
 * route is already covered by invitation-lifecycle.test.ts.
 */
async function signUpUnverifiedTestUser(): Promise<AuthenticatedTestUser> {
  const user = await signUpTestUser(app);

  await prisma.user.update({ where: { id: user.userId }, data: { emailVerified: false } });

  return user;
}

async function setUpInvitationFor(invitee: AuthenticatedTestUser) {
  const owner = await signUpTestUser(app);
  const { workspace } = await createWorkspaceWithMember(owner.userId);
  const invitation = await createInvitationDirect(
    workspace.id,
    owner.userId,
    WorkspaceRole.ADMIN,
    invitee.email,
  );

  return { workspace, invitation };
}

function expectForbidden(res: request.Response) {
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe("FORBIDDEN");
  expect(res.body.error.message).toBe(
    "Verify your email address to view or respond to invitations by email",
  );
}

describe("Invitation email-verification guard", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("does not list invitations for an unverified account", async () => {
    const invitee = await signUpUnverifiedTestUser();
    await setUpInvitationFor(invitee);

    const res = await request(app)
      .get("/api/v1/invitations")
      .set("Cookie", invitee.cookie)
      .expect(403);

    expectForbidden(res);
  });

  it("still lists invitations for a verified account", async () => {
    const invitee = await signUpTestUser(app);
    const { invitation } = await setUpInvitationFor(invitee);

    const res = await request(app)
      .get("/api/v1/invitations")
      .set("Cookie", invitee.cookie)
      .expect(200);

    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual([invitation.id]);
  });

  it("does not let an unverified account accept an invitation by id", async () => {
    const invitee = await signUpUnverifiedTestUser();
    const { workspace, invitation } = await setUpInvitationFor(invitee);

    const res = await request(app)
      .post(`/api/v1/invitations/${invitation.id}/accept`)
      .set("Cookie", invitee.cookie)
      .expect(403);

    expectForbidden(res);

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId } },
    });
    expect(membership).toBeNull();

    const persisted = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(persisted.status).toBe("PENDING");
  });

  it("rejects an unverified account before looking the invitation up, so ids can't be probed", async () => {
    const invitee = await signUpUnverifiedTestUser();

    const res = await request(app)
      .post("/api/v1/invitations/nonexistent-invitation-id/accept")
      .set("Cookie", invitee.cookie)
      .expect(403);

    expectForbidden(res);
  });

  it("does not let an unverified account decline an invitation by id", async () => {
    const invitee = await signUpUnverifiedTestUser();
    const { invitation } = await setUpInvitationFor(invitee);

    const res = await request(app)
      .post(`/api/v1/invitations/${invitation.id}/decline`)
      .set("Cookie", invitee.cookie)
      .expect(403);

    expectForbidden(res);

    const persisted = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(persisted.status).toBe("PENDING");
  });

  it("lets an unverified account accept by token, since the token proves the mailbox", async () => {
    const invitee = await signUpUnverifiedTestUser();
    const { workspace, invitation } = await setUpInvitationFor(invitee);

    const res = await request(app)
      .post(`/api/v1/invitations/token/${invitation.token}/accept`)
      .set("Cookie", invitee.cookie)
      .expect(200);

    expect(res.body.data.status).toBe("ACCEPTED");

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: invitee.userId } },
    });
    expect(membership.role).toBe(WorkspaceRole.ADMIN);
  });

  it("lets an unverified account decline by token", async () => {
    const invitee = await signUpUnverifiedTestUser();
    const { invitation } = await setUpInvitationFor(invitee);

    const res = await request(app)
      .post(`/api/v1/invitations/token/${invitation.token}/decline`)
      .set("Cookie", invitee.cookie)
      .expect(200);

    expect(res.body.data.status).toBe("DECLINED");
  });

  it("still applies the email match to token acceptance for an unverified account", async () => {
    const invitee = await signUpUnverifiedTestUser();
    const otherUser = await signUpUnverifiedTestUser();
    const { invitation } = await setUpInvitationFor(invitee);

    await request(app)
      .post(`/api/v1/invitations/token/${invitation.token}/accept`)
      .set("Cookie", otherUser.cookie)
      .expect(403);
  });
});
