import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import { addWorkspaceMember, createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

describe("GET /api/v1/workspaces/:workspaceId/members - avatar image", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("includes each member's image alongside the existing fields, and null for a member with no avatar", async () => {
    const owner = await signUpTestUser(app);
    const memberWithAvatar = await signUpTestUser(app);
    const memberWithoutAvatar = await signUpTestUser(app);

    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, memberWithAvatar.userId, "MEMBER");
    await addWorkspaceMember(workspace.id, memberWithoutAvatar.userId, "MEMBER");

    await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Cookie", memberWithAvatar.cookie)
      .attach("file", Buffer.from("member avatar probe"), {
        filename: "avatar.png",
        contentType: "image/png",
      })
      .expect(200);

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: memberWithAvatar.userId },
      select: { image: true },
    });

    const response = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const members = response.body.data as Array<Record<string, unknown>>;

    const withAvatar = members.find((member) => member.userId === memberWithAvatar.userId);
    const withoutAvatar = members.find((member) => member.userId === memberWithoutAvatar.userId);

    expect(withAvatar).toMatchObject({
      id: expect.any(String),
      userId: memberWithAvatar.userId,
      name: expect.any(String),
      email: memberWithAvatar.email,
      image: storedUser.image,
      role: "MEMBER",
      joinedAt: expect.any(String),
    });
    expect(typeof withAvatar?.image).toBe("string");

    expect(withoutAvatar).toMatchObject({
      userId: memberWithoutAvatar.userId,
      email: memberWithoutAvatar.email,
      image: null,
      role: "MEMBER",
    });
  });
});
