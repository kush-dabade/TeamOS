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

  describe("resetDatabase refuses to run against anything but teamos_test", () => {
    const realTestDatabaseUrl = process.env.DATABASE_URL;

    afterEach(() => {
      // Every case below mutates process.env.DATABASE_URL to something
      // resetDatabase() must refuse - restored immediately after each
      // assertion so the real teamos_test connection string (which every
      // other test in this suite depends on) is never left in a mutated
      // state, regardless of which branch of the assertion ran.
      process.env.DATABASE_URL = realTestDatabaseUrl;
    });

    it("refuses an obvious development database name", async () => {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/teamos";

      await expect(resetDatabase()).rejects.toThrow(/Refusing to reset database/);
    });

    it("refuses a URL where 'teamos_test' appears only outside the database name (not a substring match)", async () => {
      // The path segment - the actual database name - is "teamos", not
      // "teamos_test". A substring-matching implementation of this guard
      // would incorrectly treat this as safe just because "teamos_test"
      // appears elsewhere in the connection string; this proves the check
      // is parsing the URL properly instead.
      process.env.DATABASE_URL = "postgresql://teamos_test:teamos_test@localhost:5432/teamos";

      await expect(resetDatabase()).rejects.toThrow(/Refusing to reset database/);
    });

    it("refuses when DATABASE_URL is unset", async () => {
      delete process.env.DATABASE_URL;

      await expect(resetDatabase()).rejects.toThrow(/DATABASE_URL is not set/);
    });

    it("refuses a malformed connection string instead of guessing", async () => {
      process.env.DATABASE_URL = "not-a-valid-connection-string";

      await expect(resetDatabase()).rejects.toThrow(/not a valid connection string/);
    });

    it("does not leak DATABASE_URL contents (e.g. credentials) into the malformed-URL error", async () => {
      const secretToken = "sk_live_super_secret_12345";
      const malformedUrl = `not-a-valid-connection-string-${secretToken}`;
      process.env.DATABASE_URL = malformedUrl;

      let caught: unknown;

      try {
        await resetDatabase();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);

      const message = (caught as Error).message;

      expect(message).toBe("DATABASE_URL is not a valid connection string.");
      expect(message).not.toContain(secretToken);
      expect(message).not.toContain(malformedUrl);
    });

    it("still permits the real teamos_test database", async () => {
      process.env.DATABASE_URL = realTestDatabaseUrl;

      await expect(resetDatabase()).resolves.toBeUndefined();
    });
  });
});
