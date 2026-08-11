import { afterEach, describe, expect, it, vi } from "vitest";

import app from "../../src/app.js";
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
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
        expect.stringContaining("SECURITY"),
        expect.anything(),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("leaveWorkspace still deletes the membership and reports success when getIO() throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
        expect.stringContaining("SECURITY"),
        expect.anything(),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
