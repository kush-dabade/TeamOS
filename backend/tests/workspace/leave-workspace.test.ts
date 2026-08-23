import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

describe("Leave workspace - response contract", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("returns { success: true, data: null } and actually removes the membership", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const response = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/leave`)
      .set("Cookie", member.cookie)
      .expect(200);

    expect(response.body).toEqual({ success: true, data: null });

    const reloaded = await prisma.workspaceMember.findUnique({
      where: { id: membership.id },
    });
    expect(reloaded).toBeNull();
  });
});
