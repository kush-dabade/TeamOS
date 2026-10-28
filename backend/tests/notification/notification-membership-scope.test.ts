import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { NotificationType } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createNotificationDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

// Regression (audit F-12): a member removed from a workspace kept seeing that
// workspace's notifications - titles naming its tasks and projects - because
// every notification query filtered on recipient only.
async function setUpRemovedMember() {
  const owner = await signUpTestUser(app);
  const member = await signUpTestUser(app);

  const { workspace: sharedWorkspace } = await createWorkspaceWithMember(owner.userId);
  await addWorkspaceMember(sharedWorkspace.id, member.userId);
  const { workspace: ownWorkspace } = await createWorkspaceWithMember(member.userId);

  const fromShared = await createNotificationDirect(sharedWorkspace.id, member.userId, new Date(), {
    title: "You were assigned Secret launch plan",
  });
  const fromOwn = await createNotificationDirect(ownWorkspace.id, member.userId, new Date());

  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: sharedWorkspace.id, userId: member.userId },
  });

  return { member, sharedWorkspace, fromShared, fromOwn };
}

describe("notifications after leaving a workspace", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("drops the former workspace's notifications from the list but keeps the rest", async () => {
    const { member, fromOwn } = await setUpRemovedMember();

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie)
      .expect(200);

    expect(res.body.data.notifications.map((n: { id: string }) => n.id)).toEqual([fromOwn.id]);
    expect(JSON.stringify(res.body)).not.toContain("Secret launch plan");
  });

  it("excludes them from the unread count", async () => {
    const { member } = await setUpRemovedMember();

    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Cookie", member.cookie)
      .expect(200);

    expect(res.body.data.count).toBe(1);
  });

  it("refuses to mark one as read and leaves it untouched by mark-all", async () => {
    const { member, fromShared, fromOwn } = await setUpRemovedMember();

    await request(app)
      .patch(`/api/v1/notifications/${fromShared.id}/read`)
      .set("Cookie", member.cookie)
      .expect(403);

    await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Cookie", member.cookie)
      .expect(200);

    const [shared, own] = await Promise.all([
      prisma.notification.findUniqueOrThrow({ where: { id: fromShared.id } }),
      prisma.notification.findUniqueOrThrow({ where: { id: fromOwn.id } }),
    ]);
    expect(shared.isRead).toBe(false);
    expect(own.isRead).toBe(true);
  });

  it("still shows invitation notifications, which go to people who aren't members yet", async () => {
    const owner = await signUpTestUser(app);
    const invitee = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const invitation = await createNotificationDirect(workspace.id, invitee.userId, new Date(), {
      type: NotificationType.INVITATION_RECEIVED,
    });

    const list = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", invitee.cookie)
      .expect(200);
    expect(list.body.data.notifications.map((n: { id: string }) => n.id)).toEqual([invitation.id]);

    const count = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Cookie", invitee.cookie)
      .expect(200);
    expect(count.body.data.count).toBe(1);

    await request(app)
      .patch(`/api/v1/notifications/${invitation.id}/read`)
      .set("Cookie", invitee.cookie)
      .expect(200);
  });

  it("shows them again after the user rejoins", async () => {
    const { member, sharedWorkspace, fromShared } = await setUpRemovedMember();
    await addWorkspaceMember(sharedWorkspace.id, member.userId);

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie)
      .expect(200);

    expect(res.body.data.notifications.map((n: { id: string }) => n.id)).toContain(fromShared.id);
  });
});
