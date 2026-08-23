import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createInvitationDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

describe("Cancel invitation - response contract", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("returns { success: true, data: null } and actually removes the invitation", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const invitation = await createInvitationDirect(workspace.id, owner.userId);

    const response = await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/invitations/${invitation.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(response.body).toEqual({ success: true, data: null });

    const reloaded = await prisma.workspaceInvitation.findUnique({
      where: { id: invitation.id },
    });
    expect(reloaded).toBeNull();
  });
});
