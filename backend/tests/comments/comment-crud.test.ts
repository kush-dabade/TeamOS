import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createCommentDirect,
  setUpTaskWithOwner,
  signUpTestUser,
} from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

// Direct Prisma write, same rationale as every other *Direct fixture in
// tests/setup/fixtures.ts and the identical helper in
// tests/attachment/attachment-archived-project.test.ts - archiving has no
// security-sensitive internals worth exercising through the HTTP layer just
// to set up a test fixture. Not promoted to fixtures.ts since this is the
// second, not yet third, file to need it.
async function archiveProjectDirect(projectId: string) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });
}

describe("comment CRUD and authorization", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  describe("create", () => {
    it("creates a comment, persists it, and records a COMMENT_CREATED activity", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "This is a test comment" })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.comment).toMatchObject({
        content: "This is a test comment",
        author: { id: owner.userId },
      });

      const persisted = await prisma.comment.findUniqueOrThrow({
        where: { id: res.body.data.comment.id },
      });
      expect(persisted.workspaceId).toBe(workspace.id);
      expect(persisted.taskId).toBe(task.id);
      expect(persisted.authorId).toBe(owner.userId);
      expect(persisted.content).toBe("This is a test comment");
      expect(persisted.deletedAt).toBeNull();

      const activity = await prisma.activity.findFirst({
        where: {
          workspaceId: workspace.id,
          type: "COMMENT_CREATED",
          entityId: persisted.id,
        },
      });
      expect(activity).not.toBeNull();
    });

    it("rejects a GUEST creating a comment, and creates none", async () => {
      const { workspace, task } = await setUpTaskWithOwner(app);
      const guest = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", guest.cookie)
        .send({ content: "Guests should not be able to post this" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");

      const commentCount = await prisma.comment.count({ where: { taskId: task.id } });
      expect(commentCount).toBe(0);
    });

    it("rejects creating a comment on a task whose project is archived, and creates none", async () => {
      const { owner, task, project } = await setUpTaskWithOwner(app);
      await archiveProjectDirect(project.id);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "Should be rejected" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be modified");

      const commentCount = await prisma.comment.count({ where: { taskId: task.id } });
      expect(commentCount).toBe(0);
    });
  });

  describe("create - realtime", () => {
    let testServer: TestServer;
    const openSockets: Socket[] = [];

    beforeAll(async () => {
      testServer = await startTestServer();
    });

    afterAll(async () => {
      await testServer.close();
    });

    afterEach(() => {
      openSockets.forEach((socket) => socket.disconnect());
      openSockets.length = 0;
    });

    it("emits COMMENT_CREATED to the workspace room when a comment is created", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);

      const socket = await connectTestSocket(testServer.baseUrl, owner.cookie);
      openSockets.push(socket);

      await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_CREATED, () =>
        emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
          marker: "confirm-joined",
        }),
      );

      const eventPromise = waitForEvent<{ taskId: string; comment: { content: string } }>(
        socket,
        REALTIME_EVENTS.COMMENT_CREATED,
      );

      await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "Realtime comment" })
        .expect(201);

      const payload = await eventPromise;
      expect(payload.taskId).toBe(task.id);
      expect(payload.comment.content).toBe("Realtime comment");
    });
  });

  describe("update", () => {
    it("allows the author to update their own comment, and persists the change", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);
      const comment = await createCommentDirect(workspace.id, task.id, owner.userId, "Original");

      const res = await request(app)
        .patch(`/api/v1/comments/${comment.id}`)
        .set("Cookie", owner.cookie)
        .send({ content: "Edited by author" })
        .expect(200);

      expect(res.body.data.comment.content).toBe("Edited by author");

      const persisted = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(persisted.content).toBe("Edited by author");
    });

    it("rejects a non-author MEMBER updating another member's comment, and leaves it unchanged", async () => {
      const { workspace, task } = await setUpTaskWithOwner(app);
      const author = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, author.userId, WorkspaceRole.MEMBER);
      const comment = await createCommentDirect(workspace.id, task.id, author.userId, "Original");

      const otherMember = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, otherMember.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .patch(`/api/v1/comments/${comment.id}`)
        .set("Cookie", otherMember.cookie)
        .send({ content: "Hacked by another member" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe("You can only edit your own comments");

      const unchanged = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(unchanged.content).toBe("Original");
    });

    it("rejects a GUEST updating a comment, and leaves it unchanged", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);
      const comment = await createCommentDirect(workspace.id, task.id, owner.userId, "Original");

      const guest = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

      const res = await request(app)
        .patch(`/api/v1/comments/${comment.id}`)
        .set("Cookie", guest.cookie)
        .send({ content: "Guests cannot do this" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe("Guests cannot edit comments");

      const unchanged = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(unchanged.content).toBe("Original");
    });

    it("rejects updating a comment when its project is archived, and leaves it unchanged", async () => {
      const { owner, workspace, task, project } = await setUpTaskWithOwner(app);
      const comment = await createCommentDirect(workspace.id, task.id, owner.userId, "Original");
      await archiveProjectDirect(project.id);

      const res = await request(app)
        .patch(`/api/v1/comments/${comment.id}`)
        .set("Cookie", owner.cookie)
        .send({ content: "Should be rejected" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be modified");

      const unchanged = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(unchanged.content).toBe("Original");
    });
  });

  describe("delete", () => {
    it("allows the author to delete their own comment (soft-delete)", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);
      const comment = await createCommentDirect(workspace.id, task.id, owner.userId);

      await request(app)
        .delete(`/api/v1/comments/${comment.id}`)
        .set("Cookie", owner.cookie)
        .expect(204);

      const persisted = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(persisted.deletedAt).not.toBeNull();

      const activity = await prisma.activity.findFirst({
        where: { workspaceId: workspace.id, type: "COMMENT_DELETED", entityId: comment.id },
      });
      expect(activity).not.toBeNull();
    });

    it("allows an ADMIN to delete another member's comment", async () => {
      const { workspace, task } = await setUpTaskWithOwner(app);
      const author = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, author.userId, WorkspaceRole.MEMBER);
      const comment = await createCommentDirect(workspace.id, task.id, author.userId);

      const admin = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, admin.userId, WorkspaceRole.ADMIN);

      await request(app)
        .delete(`/api/v1/comments/${comment.id}`)
        .set("Cookie", admin.cookie)
        .expect(204);

      const persisted = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(persisted.deletedAt).not.toBeNull();
    });

    it("allows an OWNER to delete another member's comment", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);
      const author = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, author.userId, WorkspaceRole.MEMBER);
      const comment = await createCommentDirect(workspace.id, task.id, author.userId);

      await request(app)
        .delete(`/api/v1/comments/${comment.id}`)
        .set("Cookie", owner.cookie)
        .expect(204);

      const persisted = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(persisted.deletedAt).not.toBeNull();
    });

    it("rejects an ordinary MEMBER deleting another member's comment, and leaves it undeleted", async () => {
      const { workspace, task } = await setUpTaskWithOwner(app);
      const author = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, author.userId, WorkspaceRole.MEMBER);
      const comment = await createCommentDirect(workspace.id, task.id, author.userId);

      const otherMember = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, otherMember.userId, WorkspaceRole.MEMBER);

      const res = await request(app)
        .delete(`/api/v1/comments/${comment.id}`)
        .set("Cookie", otherMember.cookie)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe(
        "You do not have permission to delete this comment",
      );

      const unchanged = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(unchanged.deletedAt).toBeNull();
    });

    it("rejects a GUEST deleting a comment, and leaves it undeleted", async () => {
      const { owner, workspace, task } = await setUpTaskWithOwner(app);
      const comment = await createCommentDirect(workspace.id, task.id, owner.userId);

      const guest = await signUpTestUser(app);
      await addWorkspaceMember(workspace.id, guest.userId, WorkspaceRole.GUEST);

      const res = await request(app)
        .delete(`/api/v1/comments/${comment.id}`)
        .set("Cookie", guest.cookie)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe("Guests cannot delete comments");

      const unchanged = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(unchanged.deletedAt).toBeNull();
    });

    it("rejects deleting a comment when its project is archived, and leaves it undeleted", async () => {
      const { owner, workspace, task, project } = await setUpTaskWithOwner(app);
      const comment = await createCommentDirect(workspace.id, task.id, owner.userId);
      await archiveProjectDirect(project.id);

      const res = await request(app)
        .delete(`/api/v1/comments/${comment.id}`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Archived projects cannot be modified");

      const unchanged = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
      expect(unchanged.deletedAt).toBeNull();
    });
  });

  describe("validation", () => {
    it("rejects empty content", async () => {
      const { owner, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects whitespace-only content", async () => {
      const { owner, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "     " })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects content over 5000 characters", async () => {
      const { owner, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "a".repeat(5001) })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a missing content field", async () => {
      const { owner, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unexpected fields due to the strict schema", async () => {
      const { owner, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "Valid content", extraField: "not allowed" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("trims surrounding whitespace from valid content before persisting", async () => {
      const { owner, task } = await setUpTaskWithOwner(app);

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set("Cookie", owner.cookie)
        .send({ content: "  Padded content  " })
        .expect(201);

      expect(res.body.data.comment.content).toBe("Padded content");

      const persisted = await prisma.comment.findUniqueOrThrow({
        where: { id: res.body.data.comment.id },
      });
      expect(persisted.content).toBe("Padded content");
    });
  });
});
