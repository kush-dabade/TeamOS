import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { isLocalDevelopment } from "../../src/config/security.config.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";

/**
 * Commit 3: POST /api/v1/demo/session. Covers provisioning (a real user,
 * workspace, membership, and the same seeded content prisma/seed.ts's
 * local dev seed produces - see tests/setup/seed.test.ts for the matching
 * assertions against that generator) and authentication (the returned
 * cookie is a real Better Auth session, not a fabricated one).
 */
describe("public demo session provisioning", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("provisions a real demo user, workspace, membership, and seeded data", async () => {
    const beforeRequest = Date.now();

    const response = await request(app).post("/api/v1/demo/session").expect(201);

    expect(response.body).toEqual({
      success: true,
      data: { expiresAt: expect.any(String) },
    });

    const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;

    expect(setCookie).toBeTruthy();
    expect(setCookie!.length).toBeGreaterThan(0);

    const user = await prisma.user.findFirstOrThrow({ where: { isDemo: true } });

    expect(user.isDemo).toBe(true);
    expect(user.emailVerified).toBe(true);
    expect(user.demoExpiresAt).toBeInstanceOf(Date);
    // Roughly 3h out (DEMO_SESSION_TTL_HOURS) - bounded loosely (2h-4h)
    // rather than asserting the exact constant, so this test doesn't need
    // updating if the target TTL is ever tuned within the agreed 2-4h
    // range.
    const ttlMs = user.demoExpiresAt!.getTime() - beforeRequest;
    expect(ttlMs).toBeGreaterThan(2 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThan(4 * 60 * 60 * 1000);

    const workspace = await prisma.workspace.findFirstOrThrow({
      where: { ownerId: user.id },
    });

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    });

    expect(membership.role).toBe("OWNER");

    // Same generator prisma/seed.ts uses (demo-data-generator.ts) - same
    // counts tests/setup/seed.test.ts already pins for that caller.
    const projects = await prisma.project.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { slug: "asc" },
    });

    expect(projects.map((project) => ({ slug: project.slug, status: project.status }))).toEqual([
      { slug: "mobile-app", status: "PLANNED" },
      { slug: "product-launch", status: "COMPLETED" },
      { slug: "website-redesign", status: "ACTIVE" },
    ]);

    const taskCount = await prisma.task.count({ where: { workspaceId: workspace.id } });

    expect(taskCount).toBe(9);

    const sprint = await prisma.sprint.findFirstOrThrow({
      where: { workspaceId: workspace.id },
    });

    expect(sprint.status).toBe("ACTIVE");

    const tasksInSprint = await prisma.task.count({ where: { sprintId: sprint.id } });

    expect(tasksInSprint).toBe(3);

    const commentCount = await prisma.comment.count({ where: { workspaceId: workspace.id } });

    expect(commentCount).toBe(2);

    // Real services generate Activity rows as a side effect - not a
    // hand-maintained count to pin, just proof the feed isn't empty.
    const activityCount = await prisma.activity.count({ where: { workspaceId: workspace.id } });

    expect(activityCount).toBeGreaterThan(0);
  });

  it("never returns the generated email, password, or a session token in the response body", async () => {
    const response = await request(app).post("/api/v1/demo/session").expect(201);

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/token/i);
    expect(serialized).not.toMatch(/@teamos\.local/);
    expect(Object.keys(response.body.data)).toEqual(["expiresAt"]);
  });

  it("the returned session cookie authenticates real, existing TeamOS APIs - not a fabricated session", async () => {
    const response = await request(app).post("/api/v1/demo/session").expect(201);

    const setCookie = response.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");

    // Better Auth's own session endpoint, not a TeamOS-specific shortcut -
    // same route tests/security/auth-rate-limit.test.ts and
    // tests/realtime/session-revocation.test.ts already use to prove a
    // cookie is a real session.
    const sessionResponse = await request(app)
      .get("/api/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);

    expect(sessionResponse.body.user.id).toBeTruthy();

    const workspacesResponse = await request(app)
      .get("/api/v1/workspaces")
      .set("Cookie", cookie)
      .expect(200);

    expect(workspacesResponse.body.data).toHaveLength(1);
    expect(workspacesResponse.body.data[0].role).toBe("OWNER");
  });

  it("does not depend on isLocalDevelopment - this suite runs under NODE_ENV=test", async () => {
    // If provisioning worked BECAUSE of lib/auth.ts's local-dev-only
    // databaseHooks.user.create.before hook, this would be false here and
    // the request below would still succeed - the real proof is that this
    // constant is false in this process (see config/security.config.ts:
    // isLocalDevelopment is exactly NODE_ENV === "development", and this
    // suite's own NODE_ENV is "test") while provisioning still works,
    // meaning demo.service.ts's own explicit emailVerified update is what
    // made it work, not that hook.
    expect(isLocalDevelopment).toBe(false);

    const response = await request(app).post("/api/v1/demo/session").expect(201);

    const user = await prisma.user.findFirstOrThrow({ where: { isDemo: true } });

    expect(user.emailVerified).toBe(true);
    expect(response.status).toBe(201);
  });
});
