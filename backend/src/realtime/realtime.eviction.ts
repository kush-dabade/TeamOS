import { REALTIME_EVENTS } from "./realtime.constants.js";
import { getUserRoom, getWorkspaceRoom } from "./realtime.rooms.js";
import { getIO } from "./realtime.server.js";

const FETCH_SOCKETS_RETRY_ATTEMPTS = 3;
const FETCH_SOCKETS_RETRY_DELAY_MS = 100;

/**
 * fetchSockets() is evictFromWorkspace's one genuinely-async dependency -
 * on the current in-memory adapter it's effectively local/synchronous, but
 * it resolves through the adapter, so it becomes a real network call the
 * moment a Redis adapter is introduced (already anticipated - see
 * evictFromWorkspace's own comment). A few short, bounded retries handle
 * exactly that class of transient failure without needing any retry
 * infrastructure beyond a plain loop - deliberately not a queue: the
 * caller (removeWorkspaceMember/leaveWorkspace) already treats eviction as
 * best-effort, so a fixed, bounded number of immediate retries is the
 * simplest thing that meaningfully narrows the failure window without
 * changing that contract.
 *
 * Known boundary: today, this can only actually throw via getIO() itself
 * (fetchSockets() on the in-memory adapter has no failure mode of its own -
 * no I/O, just local Set iteration). getIO() is only null before
 * initializeRealtime() runs, before the server accepts any connections, or
 * after closeRealtime() during shutdown - and closeRealtime() is only ever
 * called from server.ts's server.close() callback, which per Node's
 * http.Server semantics only fires once every in-flight request has
 * already finished. So a live removeWorkspaceMember/leaveWorkspace call
 * cannot observe this failing in production today; the retry exists as
 * insurance for once a network-backed adapter makes fetchSockets() a
 * genuine remote call with its own failure modes.
 */
async function fetchUserSocketsWithRetry(userId: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_SOCKETS_RETRY_ATTEMPTS; attempt++) {
    try {
      return await getIO().in(getUserRoom(userId)).fetchSockets();
    } catch (error) {
      lastError = error;

      if (attempt < FETCH_SOCKETS_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, FETCH_SOCKETS_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}

/**
 * Called when a WorkspaceMember row is deleted (removeWorkspaceMember,
 * leaveWorkspace) - realtime.server.ts's joinWorkspaceRooms only runs once,
 * at connect, so an already-connected socket for the affected user would
 * otherwise keep sitting in the workspace room (and receiving its
 * broadcasts) until it happens to disconnect/reconnect on its own.
 *
 * Targets sockets via the existing per-user room (every authenticated
 * socket already joins `user:<id>` in realtime.server.ts) rather than
 * fetching the whole workspace room and filtering by user id - bounded by
 * this one user's own connection count instead of every member's, and
 * reuses an existing primitive instead of adding a new one. fetchSockets()
 * resolves through the adapter, so this keeps working unmodified if a
 * Redis adapter is ever introduced for horizontal scaling.
 *
 * Throws (after retrying) rather than swallowing its own failure - the
 * caller is the one that decides whether eviction failing should still be
 * treated as best-effort, not this function.
 */
export async function evictFromWorkspace(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const workspaceRoom = getWorkspaceRoom(workspaceId);
  const sockets = await fetchUserSocketsWithRetry(userId);

  for (const socket of sockets) {
    if (!socket.rooms.has(workspaceRoom)) {
      continue;
    }

    socket.leave(workspaceRoom);

    // Emitted directly to this socket, not via io.to(workspaceRoom) - it
    // has just left that room, so a room-targeted emit would depend on
    // room state and could race with (or simply never reach) it. A direct
    // emit on the socket itself doesn't depend on room membership at all.
    socket.emit(REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED, { workspaceId });
  }
}

/**
 * Called from lib/auth.ts's databaseHooks.session.delete.after, which fires
 * for every explicit Better Auth revocation path (sign-out, revoke-session,
 * revoke-sessions/revokeOtherSessions, revokeSessionsOnPasswordReset) since
 * they all funnel through internalAdapter.deleteSession -> deleteWithHooks.
 *
 * Deliberately session-scoped, not user-scoped: a user can hold multiple
 * concurrent sessions (e.g. laptop + phone), each authenticating its own
 * socket via socket.data.user.sessionId (set in realtime.auth.ts). Revoking
 * one session must not disconnect another still-valid session's socket for
 * the same user - fetchUserSocketsWithRetry only narrows to this user's
 * sockets, so the sessionId filter below is what actually enforces the
 * per-session boundary, not the room lookup itself.
 *
 * Unlike evictFromWorkspace, this disconnects the socket outright rather
 * than leaving a single room: a revoked session must lose every realtime
 * event it could otherwise still receive, not just one workspace's.
 * disconnect(true) closes the underlying connection (not just this
 * namespace), so the client can't keep using it and must re-handshake -
 * which re-runs authenticateSocket() and is rejected for good, since the
 * session row is already gone.
 */
export async function evictUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const sockets = await fetchUserSocketsWithRetry(userId);

  for (const socket of sockets) {
    if (socket.data.user.sessionId !== sessionId) {
      continue;
    }

    socket.emit(REALTIME_EVENTS.SESSION_REVOKED, { sessionId });
    socket.disconnect(true);
  }
}
