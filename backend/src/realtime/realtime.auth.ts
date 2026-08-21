import { fromNodeHeaders } from "better-auth/node";
import type { Socket } from "socket.io";

import { auth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import type { AuthenticatedSocket } from "./realtime.types.js";

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(socket.handshake.headers),
    });

    if (!session) {
      return next(new Error("Authentication required"));
    }

    (socket as AuthenticatedSocket).data.user = {
      id: session.user.id,
      sessionId: session.session.id,
    };

    next();
  } catch (error) {
    logger.error({ err: error }, "Socket authentication error");

    next(new Error("Authentication failed"));
  }
}
