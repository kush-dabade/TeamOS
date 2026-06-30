import { ROOM_PREFIXES } from "./realtime.constants.js";

export function getWorkspaceRoom(workspaceId: string): string {
  return `${ROOM_PREFIXES.WORKSPACE}:${workspaceId}`;
}

export function getUserRoom(userId: string): string {
  return `${ROOM_PREFIXES.USER}:${userId}`;
}
