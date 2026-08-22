import type { Socket } from "socket.io";

export interface RealtimeUser {
  id: string;
  sessionId: string;
  // Better Auth's own session.session.expiresAt, captured verbatim at
  // handshake time (see realtime.auth.ts) - the database/session response
  // is the source of truth for when this socket's session actually expires,
  // not a value reconstructed from Better Auth's expiresIn config.
  sessionExpiresAt: Date;
}

export interface AuthenticatedSocket extends Socket {
  data: Socket["data"] & {
    user: RealtimeUser;
  };
}