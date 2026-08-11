import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { prisma } from "../lib/prisma.js";
import { trustedOrigins } from "../config/security.config.js";

import { authenticateSocket } from "./realtime.auth.js";
import { getUserRoom, getWorkspaceRoom } from "./realtime.rooms.js";
import type { AuthenticatedSocket } from "./realtime.types.js";

let io: Server | null = null;

export function initializeRealtime(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: trustedOrigins,
      credentials: true,
    },
  });

  registerMiddleware(io);
  registerConnectionHandlers(io);

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized. Call initializeRealtime() first.",
    );
  }

  return io;
}

export async function closeRealtime(): Promise<void> {
  if (!io) {
    return;
  }

  await io.close();

  io = null;
}

function registerMiddleware(io: Server): void {
  io.use(authenticateSocket);
}

/**
 * Reads membership, joins rooms accordingly, then re-reads membership and
 * reconciles against the fresher read - closes a real race with
 * removeWorkspaceMember/leaveWorkspace: evictFromWorkspace only evicts
 * sockets that have already joined the affected user's `user:<id>` room at
 * the moment its own fetchSockets() snapshot runs. A socket connecting
 * concurrently with a removal can read a pre-removal membership snapshot,
 * then join the now-stale workspace room *after* that eviction snapshot
 * already ran (and therefore never saw this socket), ending up
 * indefinitely subscribed to a room it's no longer authorized for.
 *
 * The second read closes that window without a lock: any removal that
 * committed before this second query is caught right here, self-correcting
 * the stale join before connection setup even finishes. A removal that
 * commits after this second query is caught by the normal
 * evictFromWorkspace path instead, since by then this socket is already
 * fully joined (both rooms) and discoverable - the same "already connected"
 * case the realtime test suite already covers. What remains is a purely
 * in-process window between this query resolving and the loop below
 * finishing, not one spanning a database round trip.
 *
 * The reconciliation is join-then-leave, not leave-then-join: every room in
 * the fresher, second read is (re-)joined first - socket.join() on an
 * already-joined room is a no-op, so this is safe to call unconditionally
 * and is what covers a membership *created* between the two reads (the
 * initial read alone would otherwise never see it, leaving the socket
 * permanently unjoined to a workspace it's already a member of until its
 * next reconnect). Only then are rooms from the initial read that are
 * absent from the second read left - since anything genuinely still
 * current was already re-joined above, this can only affect rooms that
 * really did become stale, so it can't undo the join it just did.
 */
async function joinWorkspaceRooms(socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.data.user.id;

  const initialMemberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
    },
    select: {
      workspaceId: true,
    },
  });

  for (const membership of initialMemberships) {
    socket.join(getWorkspaceRoom(membership.workspaceId));
  }

  const currentMemberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
    },
    select: {
      workspaceId: true,
    },
  });
  const currentWorkspaceIds = new Set(
    currentMemberships.map((membership) => membership.workspaceId),
  );

  for (const workspaceId of currentWorkspaceIds) {
    socket.join(getWorkspaceRoom(workspaceId));
  }

  for (const membership of initialMemberships) {
    if (!currentWorkspaceIds.has(membership.workspaceId)) {
      socket.leave(getWorkspaceRoom(membership.workspaceId));
    }
  }

  console.log(
    `Socket ${socket.id} joined ${currentWorkspaceIds.size} workspace room(s)`,
  );
}

function joinUserRoom(socket: AuthenticatedSocket): void {
  socket.join(getUserRoom(socket.data.user.id));
}

function registerConnectionHandlers(io: Server): void {
  io.on("connection", async (socket) => {
    try {
      const authenticatedSocket = socket as AuthenticatedSocket;

      // Joined first, synchronously, before any database round trip -
      // makes this socket discoverable via fetchSockets() on the user room
      // (see realtime.eviction.ts) from the earliest possible moment,
      // which joinWorkspaceRooms's own re-verification above depends on to
      // close the join/eviction race.
      joinUserRoom(authenticatedSocket);

      await joinWorkspaceRooms(authenticatedSocket);

      console.log(`Socket connected: ${socket.id}`);

      socket.on("disconnect", (reason) => {
        console.log(`Socket disconnected: ${socket.id} (${reason})`);
      });
    } catch (error) {
      console.error("Socket connection setup failed:", error);

      socket.disconnect(true);
    }
  });
}
