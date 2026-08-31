import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

/**
 * Proves demo identities are subject to the exact same
 * requireWorkspaceMembership check as any other user - isDemo grants
 * nothing and removes nothing from the existing authorization model (see
 * shared/authorization/workspace-access.ts, unmodified by Commit 3).
 * Mirrors tests/security/tenant-isolation.test.ts's "attacker only ever
 * supplies IDs, never a session from within the target workspace" shape.
 */
describe("demo session tenant isolation", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  async function provisionDemo(): Promise<{
    cookie: string;
    userId: string;
    workspaceId: string;
  }> {
    const response = await request(app).post("/api/v1/demo/session").expect(201);

    const setCookie = response.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");

    const sessionResponse = await request(app)
      .get("/api/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);

    const userId = sessionResponse.body.user.id as string;

    const workspace = await prisma.workspace.findFirstOrThrow({ where: { ownerId: userId } });

    return { cookie, userId, workspaceId: workspace.id };
  }

  it("Demo A can access its own provisioned workspace", async () => {
    const demoA = await provisionDemo();

    const res = await request(app)
      .get(`/api/v1/workspaces/${demoA.workspaceId}`)
      .set("Cookie", demoA.cookie)
      .expect(200);

    expect(res.body.data.id).toBe(demoA.workspaceId);
  });

  it("Demo A cannot access Demo B's workspace", async () => {
    const demoA = await provisionDemo();
    const demoB = await provisionDemo();

    const res = await request(app)
      .get(`/api/v1/workspaces/${demoB.workspaceId}`)
      .set("Cookie", demoA.cookie)
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");

    // Also mutation-tested, not just the read path: Demo A must not be
    // able to create resources inside Demo B's workspace either.
    const createRes = await request(app)
      .post(`/api/v1/workspaces/${demoB.workspaceId}/projects`)
      .set("Cookie", demoA.cookie)
      .send({ name: "Injected project", ownerId: demoA.userId })
      .expect(403);

    expect(createRes.body.error.code).toBe("FORBIDDEN");

    const projectCount = await prisma.project.count({ where: { workspaceId: demoB.workspaceId } });

    expect(projectCount).toBe(3); // unchanged - still exactly the seeded set
  });

  it("Demo A cannot access an existing real (non-demo) user's workspace", async () => {
    const demoA = await provisionDemo();

    const realUser = await signUpTestUser(app);
    const { workspace: realWorkspace } = await createWorkspaceWithMember(realUser.userId);

    const res = await request(app)
      .get(`/api/v1/workspaces/${realWorkspace.id}`)
      .set("Cookie", demoA.cookie)
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("a real user cannot access a demo workspace", async () => {
    const demoA = await provisionDemo();

    const realUser = await signUpTestUser(app);

    const res = await request(app)
      .get(`/api/v1/workspaces/${demoA.workspaceId}`)
      .set("Cookie", realUser.cookie)
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
