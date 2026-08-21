import type { RealtimeEvent } from "./realtime.constants.js";

import { logger } from "../lib/logger.js";
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
    // Best-effort: every domain event pushed over realtime is already
    // persisted (DB row, activity log, notification, ...) before this
    // runs - a failed live push just means the affected client(s) will see
    // the change on their next fetch instead of immediately.
    logger.warn({ err: error, event, room }, "Failed to emit realtime event to room");
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