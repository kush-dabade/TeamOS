import type { Socket } from "socket.io";

export interface RealtimeUser {
  id: string;
  sessionId: string;
}

export interface AuthenticatedSocket extends Socket {
  data: Socket["data"] & {
    user: RealtimeUser;
  };
}