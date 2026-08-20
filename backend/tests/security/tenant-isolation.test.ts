import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { NotificationType } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createActivityDirect,
  createAttachmentDirect,
  createCommentDirect,
  createInvitationDirect,
  createProjectDirect,
  createSprintDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * Every scenario below follows the same shape: an "attacker" who is a
 * legitimate OWNER of their own workspace, and a "target" workspace the
 * attacker has no membership in at all. The attacker only ever supplies
 * IDs belonging to the target workspace's resources - never a session
 * from within the target workspace - so a passing test proves the
 * membership check (not merely a role check) is what's rejecting the
 * request.
 */
async function createCrossWorkspaceScenario() {
  const attacker = await signUpTestUser(app);
  const { workspace: attackerWorkspace } = await createWorkspaceWithMember(
    attacker.userId,
  );

  const targetOwner = await signUpTestUser(app);
  const { workspace: targetWorkspace } = await createWorkspaceWithMember(
    targetOwner.userId,
  );

  const targetProject = await createProjectDirect(
    targetWorkspace.id,
    targetOwner.userId,
    "Target Workspace Project",
  );

  const targetTask = await createTaskDirect(
    targetWorkspace.id,
    targetProject.id,
    targetOwner.userId,
    "Target Workspace Task",
  );

  return {
    attacker,
    attackerWorkspace,
    targetOwner,
    targetWorkspace,
    targetProject,
    targetTask,
  };
}

describe("tenant isolation", () => {
  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters are cleared automatically by the global
    // afterEach in tests/setup/rate-limit-cleanup-hook.ts.
  });

  describe("cross-workspace read", () => {
    it("T1: rejects reading another workspace's project by guessed ID", async () => {
      const { attacker, targetProject } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/projects/${targetProject.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("T2: rejects reading another workspace's task by guessed ID", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("cross-workspace mutation", () => {
    it("T3: rejects updating another workspace's task, and leaves it unchanged", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .patch(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", attacker.cookie)
        .send({ title: "Hacked by attacker" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(unchangedTask.title).toBe("Target Workspace Task");
    });

    it("T4: rejects updating another workspace's project, and leaves it unchanged", async () => {
      const { attacker, targetProject } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .patch(`/api/v1/projects/${targetProject.id}`)
        .set("Cookie", attacker.cookie)
        .send({ name: "Hacked Project Name" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedProject = await prisma.project.findUniqueOrThrow({
        where: { id: targetProject.id },
      });
      expect(unchangedProject.name).toBe("Target Workspace Project");
    });
  });

  describe("cross-workspace deletion", () => {
    it("T5: rejects deleting another workspace's task, and leaves it undeleted", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .delete(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(unchangedTask.deletedAt).toBeNull();
    });
  });

  describe("cross-workspace nested resource access", () => {
    it("T6: rejects commenting on another workspace's task, and creates no comment", async () => {
      const { attacker, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .post(`/api/v1/tasks/${targetTask.id}/comments`)
        .set("Cookie", attacker.cookie)
        .send({ content: "Malicious comment from an outsider" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const commentCount = await prisma.comment.count({
        where: { taskId: targetTask.id },
      });
      expect(commentCount).toBe(0);
    });

    it("T7: rejects assigning another workspace's task to the attacker's own sprint", async () => {
      const { attacker, attackerWorkspace, targetTask } =
        await createCrossWorkspaceScenario();

      // The attacker is a legitimate OWNER of their own workspace, so this
      // sprint is entirely valid - the attack is supplying a taskId that
      // belongs to a different workspace entirely.
      const attackerProject = await createProjectDirect(
        attackerWorkspace.id,
        attacker.userId,
        "Attacker Workspace Project",
      );
      const attackerSprint = await createSprintDirect(
        attackerWorkspace.id,
        attackerProject.id,
      );

      const res = await request(app)
        .post(
          `/api/v1/sprints/${attackerSprint.id}/tasks/${targetTask.id}`,
        )
        .set("Cookie", attacker.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe(
        "Task and sprint must belong to the same workspace",
      );

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(unchangedTask.sprintId).toBeNull();
    });

    it("T8: rejects assigning a same-workspace task from a different project to a sprint", async () => {
      const attacker = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(attacker.userId);

      // Both projects live in the same workspace the attacker legitimately
      // owns - the attack is crossing a project boundary, not a workspace
      // boundary, so this must be rejected by the project-match check
      // specifically (task.projectId !== sprint.projectId), not the
      // workspace-match check that T7 already exercises.
      const sprintProject = await createProjectDirect(
        workspace.id,
        attacker.userId,
        "Sprint's Project",
      );
      const otherProject = await createProjectDirect(
        workspace.id,
        attacker.userId,
        "Other Project",
      );

      const sprint = await createSprintDirect(workspace.id, sprintProject.id);
      const otherProjectTask = await createTaskDirect(
        workspace.id,
        otherProject.id,
        attacker.userId,
      );

      const res = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks/${otherProjectTask.id}`)
        .set("Cookie", attacker.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");

      const unchangedTask = await prisma.task.findUniqueOrThrow({
        where: { id: otherProjectTask.id },
      });
      expect(unchangedTask.sprintId).toBeNull();
    });
  });

  describe("same-workspace access (negative controls)", () => {
    // T1-T8 above only prove something rejects cross-workspace access - on
    // their own they'd pass identically if every request were rejected
    // unconditionally. These controls prove the opposite case still works,
    // so a 403/400 above is meaningful rather than a blanket deny.

    it("control: a legitimate workspace member can read their own project", async () => {
      const { targetOwner, targetProject } =
        await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/projects/${targetProject.id}`)
        .set("Cookie", targetOwner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetProject.id);
    });

    it("control: a legitimate workspace member can read their own task", async () => {
      const { targetOwner, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .get(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", targetOwner.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetTask.id);
    });

    it("control: a legitimate workspace member can update their own task", async () => {
      const { targetOwner, targetTask } = await createCrossWorkspaceScenario();

      const res = await request(app)
        .patch(`/api/v1/tasks/${targetTask.id}`)
        .set("Cookie", targetOwner.cookie)
        .send({ title: "Legitimately updated title" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Legitimately updated title");

      const updatedTask = await prisma.task.findUniqueOrThrow({
        where: { id: targetTask.id },
      });
      expect(updatedTask.title).toBe("Legitimately updated title");
    });
  });

  describe("cross-workspace attachment access", () => {
    it("T13: rejects downloading another workspace's attachment, and exposes no content", async () => {
      const { attacker, targetWorkspace, targetTask, targetOwner } =
        await createCrossWorkspaceScenario();

      const targetAttachment = await createAttachmentDirect(
        targetWorkspace.id,
        targetTask.id,
        targetOwner.userId,
      );

      // downloadAttachment() calls requireWorkspaceMembership() before it
      // ever touches storageService.stream() (attachment.service.ts), so
      // this 403 proves the authorization boundary rejected the request
      // before any file content could be streamed - not that the file
      // happened to be missing from disk.
      const res = await request(app)
        .get(`/api/v1/attachments/${targetAttachment.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("T14: rejects deleting another workspace's attachment, and leaves it undeleted", async () => {
      const { attacker, targetWorkspace, targetTask, targetOwner } =
        await createCrossWorkspaceScenario();

      const targetAttachment = await createAttachmentDirect(
        targetWorkspace.id,
        targetTask.id,
        targetOwner.userId,
      );

      const res = await request(app)
        .delete(`/api/v1/attachments/${targetAttachment.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedAttachment = await prisma.attachment.findUniqueOrThrow({
        where: { id: targetAttachment.id },
      });
      expect(unchangedAttachment.id).toBe(targetAttachment.id);
    });
  });

  describe("cross-user notification access", () => {
    // T15 (notification read cross-user) is not applicable: there is no
    // single-notification GET-by-ID endpoint. The only read path is
    // GET /api/v1/notifications, which is unconditionally scoped to the
    // caller's own recipientId server-side (notification.service.ts,
    // listNotifications) and takes no notification ID at all, so there is
    // no ID-based lookup surface to test here.

    it("T16: rejects marking another user's notification as read, and leaves it unread", async () => {
      const userA = await signUpTestUser(app);
      const userB = await signUpTestUser(app);

      const { workspace } = await createWorkspaceWithMember(userB.userId);

      const notification = await prisma.notification.create({
        data: {
          workspaceId: workspace.id,
          recipientId: userB.userId,
          type: NotificationType.TASK_ASSIGNED,
          title: "You were assigned a task",
          message: "Test notification",
        },
      });

      // markNotificationAsRead() checks notification.recipientId !== actorId
      // directly (notification.service.ts) rather than the shared
      // requireWorkspaceMembership() primitive - userA isn't even a member
      // of userB's workspace, but that's incidental here, the rejection is
      // driven entirely by the recipient check.
      const res = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set("Cookie", userA.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedNotification = await prisma.notification.findUniqueOrThrow({
        where: { id: notification.id },
      });
      expect(unchangedNotification.isRead).toBe(false);
      expect(unchangedNotification.readAt).toBeNull();
    });
  });

  describe("cross-workspace sprint access", () => {
    // Sprint has no DELETE endpoint (only GET/PATCH/start/complete exist in
    // sprint-item.routes.ts), so a delete case is intentionally not
    // included here rather than inventing one.

    it("T17: rejects reading another workspace's sprint by guessed ID", async () => {
      const { attacker, targetWorkspace, targetProject } =
        await createCrossWorkspaceScenario();

      const targetSprint = await createSprintDirect(
        targetWorkspace.id,
        targetProject.id,
      );

      const res = await request(app)
        .get(`/api/v1/sprints/${targetSprint.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("T17: rejects updating another workspace's sprint, and leaves it unchanged", async () => {
      const { attacker, targetWorkspace, targetProject } =
        await createCrossWorkspaceScenario();

      const targetSprint = await createSprintDirect(
        targetWorkspace.id,
        targetProject.id,
      );

      const res = await request(app)
        .patch(`/api/v1/sprints/${targetSprint.id}`)
        .set("Cookie", attacker.cookie)
        .send({ name: "Hacked Sprint Name" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedSprint = await prisma.sprint.findUniqueOrThrow({
        where: { id: targetSprint.id },
      });
      expect(unchangedSprint.name).toBe(targetSprint.name);
    });
  });

  describe("cross-workspace comment mutation", () => {
    it("T18: rejects updating another workspace's comment, and leaves it unchanged", async () => {
      const { attacker, targetWorkspace, targetTask, targetOwner } =
        await createCrossWorkspaceScenario();

      const targetComment = await createCommentDirect(
        targetWorkspace.id,
        targetTask.id,
        targetOwner.userId,
        "Original comment",
      );

      const res = await request(app)
        .patch(`/api/v1/comments/${targetComment.id}`)
        .set("Cookie", attacker.cookie)
        .send({ content: "Hacked comment" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedComment = await prisma.comment.findUniqueOrThrow({
        where: { id: targetComment.id },
      });
      expect(unchangedComment.content).toBe("Original comment");
    });

    it("T19: rejects deleting another workspace's comment, and leaves it undeleted", async () => {
      const { attacker, targetWorkspace, targetTask, targetOwner } =
        await createCrossWorkspaceScenario();

      const targetComment = await createCommentDirect(
        targetWorkspace.id,
        targetTask.id,
        targetOwner.userId,
        "Original comment",
      );

      const res = await request(app)
        .delete(`/api/v1/comments/${targetComment.id}`)
        .set("Cookie", attacker.cookie)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchangedComment = await prisma.comment.findUniqueOrThrow({
        where: { id: targetComment.id },
      });
      expect(unchangedComment.deletedAt).toBeNull();
    });
  });

  describe("cross-workspace invitation access", () => {
    // Unlike every other resource in this file, cancelInvitation() and
    // resendInvitation() scope their lookup to *both* the actor's own
    // workspaceId route param and the invitationId
    // (getWorkspaceInvitationById), rather than deriving the workspace from
    // the fetched row. The attacker is a legitimate OWNER of their own
    // workspace, so requireWorkspaceMembership()/requireRole() both pass -
    // the invitation simply isn't found under the attacker's own
    // workspaceId, so this is expected to be a 404, not the 403 seen
    // everywhere else in this file.

    it("T20: rejects canceling another workspace's invitation (404, not 403), and leaves it unchanged", async () => {
      const { attacker, attackerWorkspace, targetWorkspace, targetOwner } =
        await createCrossWorkspaceScenario();

      const targetInvitation = await createInvitationDirect(
        targetWorkspace.id,
        targetOwner.userId,
      );

      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${attackerWorkspace.id}/invitations/${targetInvitation.id}`,
        )
        .set("Cookie", attacker.cookie)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");

      const unchangedInvitation =
        await prisma.workspaceInvitation.findUniqueOrThrow({
          where: { id: targetInvitation.id },
        });
      expect(unchangedInvitation.status).toBe("PENDING");
    });

    it("T20: rejects resending another workspace's invitation (404, not 403), and leaves it unchanged", async () => {
      const { attacker, attackerWorkspace, targetWorkspace, targetOwner } =
        await createCrossWorkspaceScenario();

      const targetInvitation = await createInvitationDirect(
        targetWorkspace.id,
        targetOwner.userId,
      );

      const res = await request(app)
        .post(
          `/api/v1/workspaces/${attackerWorkspace.id}/invitations/${targetInvitation.id}/resend`,
        )
        .set("Cookie", attacker.cookie)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");

      const unchangedInvitation =
        await prisma.workspaceInvitation.findUniqueOrThrow({
          where: { id: targetInvitation.id },
        });
      expect(unchangedInvitation.expiresAt.getTime()).toBe(
        targetInvitation.expiresAt.getTime(),
      );
    });
  });

  describe("cross-workspace activity feed read", () => {
    it("T21: excludes another workspace's activity from the caller's own feed", async () => {
      const attacker = await signUpTestUser(app);
      const { workspace: attackerWorkspace } = await createWorkspaceWithMember(
        attacker.userId,
      );

      const targetOwner = await signUpTestUser(app);
      const { workspace: targetWorkspace } = await createWorkspaceWithMember(
        targetOwner.userId,
      );

      const ownActivity = await createActivityDirect(
        attackerWorkspace.id,
        attacker.userId,
        new Date(),
      );
      const targetActivity = await createActivityDirect(
        targetWorkspace.id,
        targetOwner.userId,
        new Date(),
      );

      // The attacker is requesting their *own* workspace's feed - a
      // legitimate, authorized 200 request - so this isn't testing the
      // requireWorkspaceMembership() gate (already proven elsewhere in this
      // file). It's testing that the `where: { workspaceId }` filter in
      // listWorkspaceActivities() actually scopes the query, rather than
      // merely observing an empty feed that could just mean the attacker's
      // workspace has no activity yet.
      const res = await request(app)
        .get(`/api/v1/workspaces/${attackerWorkspace.id}/activity`)
        .set("Cookie", attacker.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);

      const activityIds = res.body.data.activities.map(
        (activity: { id: string }) => activity.id,
      );

      expect(activityIds).toContain(ownActivity.id);
      expect(activityIds).not.toContain(targetActivity.id);
    });
  });
});
