import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createWorkspaceWithMember,
  signUpDemoTestUser,
  signUpTestUser,
} from "../setup/fixtures.js";

/**
 * Commit 5: a demo identity (modules/demo/, Commit 3) must not be able to
 * use the real invitation pipeline to send email to arbitrary external
 * addresses. Enforced in invitation.service.ts's createInvitation, server
 * side, from a fresh database read of isDemo - never from anything the
 * request itself supplies.
 */
describe("demo invitation restriction", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("rejects a demo user's invitation attempt, persists nothing, and enqueues no email", async () => {
    const demoOwner = await signUpDemoTestUser(app);
    const { workspace } = await createWorkspaceWithMember(demoOwner.userId);

    const jobCountBefore = (
      await emailQueue.getJobs(["waiting", "delayed", "active", "completed"])
    ).length;

    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", demoOwner.cookie)
      .send({ email: "outside-target@example.com", role: "MEMBER" })
      .expect(403);

    expect(res.body).toEqual({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Demo accounts cannot send workspace invitations.",
      },
    });

    const invitationCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: workspace.id },
    });
    expect(invitationCount).toBe(0);

    const jobsAfter = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    expect(jobsAfter).toHaveLength(jobCountBefore);
    expect(
      jobsAfter.some(
        (job) =>
          job.name === EMAIL_JOB_NAMES.WORKSPACE_INVITATION &&
          (job.data as { email?: string }).email === "outside-target@example.com",
      ),
    ).toBe(false);
  });

  it("still allows a real (non-demo) user to create an invitation, unchanged", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie)
      .send({ email: "real-invitee@example.com", role: "MEMBER" })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe("real-invitee@example.com");
    expect(res.body.data.status).toBe("PENDING");

    const persisted = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(persisted.workspaceId).toBe(workspace.id);
  });
});
