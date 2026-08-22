import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { logger } from "../../src/lib/logger.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  leaveWorkspace,
  removeWorkspaceMember,
} from "../../src/modules/workspace/workspace.service.js";

import { resetDatabase } from "../setup/reset-database.js";
import { addWorkspaceMember, createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

/**
 * Deliberately does NOT call startTestServer()/initializeRealtime() anywhere
 * in this file - Vitest gives each test file its own fresh module registry
 * (see test-server.ts's own comment on the `io` singleton), so leaving
 * realtime.server.ts's `io` singleton uninitialized here makes getIO()
 * throw exactly the way it would if the realtime layer were genuinely down.
 * That's the fault this file exists to inject: removeWorkspaceMember and
 * leaveWorkspace both treat eviction as best-effort (see their own comments
 * in workspace.service.ts), and this proves that contract holds even when
 * eviction can never succeed, not just when it's merely slow.
 */
describe("workspace membership mutations tolerate a fully unavailable realtime layer", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("removeWorkspaceMember still deletes the membership and reports success when getIO() throws", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    try {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const target = await signUpTestUser(app);
      const membership = await addWorkspaceMember(workspace.id, target.userId);

      const result = await removeWorkspaceMember(owner.userId, workspace.id, membership.id);

      expect(result).toEqual({ success: true });

      const remaining = await prisma.workspaceMember.findUnique({
        where: { id: membership.id },
      });
      expect(remaining).toBeNull();

      // Confirms the failure was surfaced loudly rather than swallowed
      // silently - see removeWorkspaceMember's own "SECURITY:"-prefixed
      // log message.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.anything() }),
        expect.stringContaining("SECURITY"),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("leaveWorkspace still deletes the membership and reports success when getIO() throws", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    try {
      const owner = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);

      const target = await signUpTestUser(app);
      const membership = await addWorkspaceMember(workspace.id, target.userId);

      const result = await leaveWorkspace(target.userId, workspace.id);

      expect(result).toEqual({ success: true });

      const remaining = await prisma.workspaceMember.findUnique({
        where: { id: membership.id },
      });
      expect(remaining).toBeNull();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.anything() }),
        expect.stringContaining("SECURITY"),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});

/**
 * Same fault injection as above (no startTestServer()/initializeRealtime()
 * in this file, so getIO() throws exactly as it would if the realtime layer
 * were genuinely down), applied to session revocation's own best-effort
 * contract instead of workspace membership's: lib/auth.ts's
 * databaseHooks.session.delete.after must not let a failing
 * evictUserSession() call break sign-out itself.
 */
describe("session revocation tolerates a fully unavailable realtime layer", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("sign-out still deletes the session and reports success when getIO() throws", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    try {
      const user = await signUpTestUser(app);

      const signOutResponse = await request(app)
        .post("/api/auth/sign-out")
        .set("Cookie", user.cookie)
        .expect(200);

      expect(signOutResponse.body).toEqual({ success: true });

      const remainingSessions = await prisma.session.findMany({
        where: { userId: user.userId },
      });
      expect(remainingSessions).toHaveLength(0);

      // Confirms the failure was surfaced loudly rather than swallowed
      // silently - see the databaseHooks.session.delete.after hook's own
      // "SECURITY:"-prefixed log message in lib/auth.ts.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.anything(), userId: user.userId }),
        expect.stringContaining("SECURITY"),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
