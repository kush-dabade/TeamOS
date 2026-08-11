import { REALTIME_EVENTS } from "./realtime.constants.js";
import { getUserRoom, getWorkspaceRoom } from "./realtime.rooms.js";
import { getIO } from "./realtime.server.js";

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
 */
export async function evictFromWorkspace(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const workspaceRoom = getWorkspaceRoom(workspaceId);
  const sockets = await getIO().in(getUserRoom(userId)).fetchSockets();

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
