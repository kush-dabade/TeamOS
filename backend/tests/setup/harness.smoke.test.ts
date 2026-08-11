import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { startTestServer, type TestServer } from "./test-server.js";
import { resetDatabase } from "./reset-database.js";
import { createWorkspaceWithMember, signUpTestUser } from "./fixtures.js";

/**
 * Validates the harness itself (server boot/teardown, real Better Auth
 * fixtures, database reset) - not application security behavior. Commit
 * #4's realtime isolation tests and Commit #7's rate-limit/header tests
 * are separate, later additions.
 */
describe("test harness", () => {
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

  it("boots a real server that responds to health checks", async () => {
    const response = await request(server.baseUrl).get("/health").expect(200);

    expect(response.body).toEqual({ success: true, message: "TeamOS API is running" });
  });

  it("signs up a real user through Better Auth and returns a usable session cookie", async () => {
    const { userId, cookie } = await signUpTestUser(app);

    expect(userId).toBeTruthy();

    const response = await request(app)
      .get("/api/v1/workspaces")
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body).toMatchObject({ success: true });
  });

  it("creates a workspace/membership fixture visible to an authenticated request", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    const response = await request(app)
      .get("/api/v1/workspaces")
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workspace.id })]),
    );
  });

  it("resetDatabase clears state between tests", async () => {
    const userCountBefore = await prisma.user.count();

    expect(userCountBefore).toBe(0);

    await signUpTestUser(app);

    expect(await prisma.user.count()).toBe(1);
  });
});
