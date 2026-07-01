import type { RealtimeEvent } from "./realtime.constants.js";

import { getUserRoom, getWorkspaceRoom } from "./realtime.rooms.js";
import { getIO } from "./realtime.server.js";

export function emitToRoom(
  room: string,
  event: RealtimeEvent,
  payload: unknown,
): void {
  try {
    getIO().to(room).emit(event, payload);
  } catch (error) {
    console.error(
      `Failed to emit realtime event "${event}" to room "${room}":`,
      error,
    );
  }
}

export function emitToWorkspace(
  workspaceId: string,
  event: RealtimeEvent,
  payload: unknown,
): void {
  emitToRoom(getWorkspaceRoom(workspaceId), event, payload);
}

export function emitToUser(
  userId: string,
  event: RealtimeEvent,
  payload: unknown,
): void {
  emitToRoom(getUserRoom(userId), event, payload);
}