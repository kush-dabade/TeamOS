import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { trustedOrigins } from "../config/security.config.js";

import { authenticateSocket } from "./realtime.auth.js";
import { REALTIME_EVENTS } from "./realtime.constants.js";
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

  logger.info(
    { socketId: socket.id, workspaceCount: currentWorkspaceIds.size },
    "Socket joined workspace rooms",
  );
}

function joinUserRoom(socket: AuthenticatedSocket): void {
  socket.join(getUserRoom(socket.data.user.id));
}

/**
 * Emits SESSION_REVOKED and fully disconnects the socket - the same pair of
 * effects Commit 1's evictUserSession performs for explicit revocation,
 * applied directly to a single already-known socket here instead. Passive
 * expiry deliberately does NOT call evictUserSession: that helper exists to
 * *find* a user's affected socket(s) via fetchUserSocketsWithRetry, but here
 * the affected socket is already the exact one this timer was scheduled
 * against, so re-fetching would only add an unnecessary lookup (a real
 * network round trip once a Redis adapter is ever introduced) for no
 * benefit.
 */
function revokeSocketSession(socket: AuthenticatedSocket): void {
  socket.emit(REALTIME_EVENTS.SESSION_REVOKED, { sessionId: socket.data.user.sessionId });
  socket.disconnect(true);
}

/**
 * Closes the gap evictUserSession's databaseHooks.session.delete.after path
 * (Commit 1) can't: that hook only fires when Better Auth's session row is
 * actually deleted, which happens on explicit revocation or the next time
 * anything calls getSession() with that token again - a socket that stays
 * open with no further HTTP activity from its own browser would otherwise
 * never be caught. A single setTimeout tied to this one socket's own known
 * expiry (session.session.expiresAt, captured verbatim at handshake time in
 * authenticateSocket - see realtime.types.ts) is enough: nothing here
 * outlives this one connection, no watcher, no polling.
 *
 * SESSION_EXPIRES_IN_SECONDS (7 days, see lib/auth.ts) is comfortably under
 * setTimeout's ~24.8-day 32-bit signed delay ceiling, so a plain setTimeout
 * needs no chunking.
 *
 * A session whose expiresAt has already passed by the time this runs gets
 * its delay clamped to 0 rather than handed a negative value - Node's own
 * setTimeout already clamps any delay below 1ms to 1ms, so this still fires
 * effectively immediately, without special-casing a synchronous inline
 * disconnect here. That matters beyond simplicity: revokeSocketSession()
 * disconnects the socket, which synchronously fires its "disconnect" event
 * (verified against the installed socket.io - Socket#_onclose emits
 * "disconnect" inline, not deferred), so an inline call here could fire
 * before registerConnectionHandlers below has registered its own
 * "disconnect" listener. Always deferring through setTimeout - even by
 * ~1ms - means the caller never has to worry about that ordering.
 */
function scheduleSessionExpiry(socket: AuthenticatedSocket): NodeJS.Timeout {
  const delayMs = Math.max(socket.data.user.sessionExpiresAt.getTime() - Date.now(), 0);

  return setTimeout(() => revokeSocketSession(socket), delayMs);
}

function registerConnectionHandlers(io: Server): void {
  io.on("connection", async (socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;

    const expiryTimer = scheduleSessionExpiry(authenticatedSocket);

    // Clears the expiry timer on every disconnect path, including the
    // connection-setup-failure catch block's own socket.disconnect(true)
    // below - "disconnect" fires regardless of why the socket closed, so
    // this one listener is enough to keep the timer from outliving its
    // socket (Case A/C: a socket that's already gone must not still act
    // later when the timer would otherwise have fired).
    socket.on("disconnect", (reason) => {
      clearTimeout(expiryTimer);
      logger.info({ socketId: socket.id, reason }, "Socket disconnected");
    });

    try {
      // Joined first, synchronously, before any database round trip -
      // makes this socket discoverable via fetchSockets() on the user room
      // (see realtime.eviction.ts) from the earliest possible moment,
      // which joinWorkspaceRooms's own re-verification above depends on to
      // close the join/eviction race.
      joinUserRoom(authenticatedSocket);

      await joinWorkspaceRooms(authenticatedSocket);

      logger.info({ socketId: socket.id }, "Socket connected");
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, "Socket connection setup failed");

      socket.disconnect(true);
    }
  });
}
