import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createAttachmentDirect,
  setUpTaskWithOwner,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * Regression test locking in current, intentional behavior:
 * attachment.service.ts's deleteAttachment has no author/uploader ownership
 * check (unlike comments.service.ts's deleteComment, which is author-or-
 * ADMIN/OWNER). Any non-GUEST workspace member can delete any attachment in
 * their workspace - a shared-artifact model, confirmed during the PR 3
 * audit as intentional and precedent-consistent with task.service.ts (also
 * no ownership check). This test does NOT propose changing that; it exists
 * to catch an accidental future regression in either direction.
 */
describe("attachment delete authorization (current shared-artifact behavior)", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("allows a non-uploader, non-admin MEMBER to delete another member's attachment", async () => {
    const { workspace, task } = await setUpTaskWithOwner(app);

    const uploader = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, uploader.userId, WorkspaceRole.MEMBER);
    const attachment = await createAttachmentDirect(workspace.id, task.id, uploader.userId);

    const otherMember = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, otherMember.userId, WorkspaceRole.MEMBER);

    await request(app)
      .delete(`/api/v1/attachments/${attachment.id}`)
      .set("Cookie", otherMember.cookie)
      .expect(204);

    const persisted = await prisma.attachment.findUnique({ where: { id: attachment.id } });
    expect(persisted).toBeNull();
  });

  it("rejects a GUEST deleting an attachment, and leaves it undeleted", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);
    const attachment = await createAttachmentDirect(workspace.id, task.id, owner.userId);

    const guest = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

    const res = await request(app)
      .delete(`/api/v1/attachments/${attachment.id}`)
      .set("Cookie", guest.cookie)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toBe("Guests cannot delete attachments.");

    const persisted = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachment.id },
    });
    expect(persisted.id).toBe(attachment.id);
  });
});
