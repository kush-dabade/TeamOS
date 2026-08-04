import { io, type Socket } from "socket.io-client";

import { env } from "@/lib";

// Socket.IO attaches directly to the backend's HTTP server root (see
// backend/src/realtime/realtime.server.ts), not under the /api/v1 REST
// prefix, so this connects to env.apiUrl directly rather than reusing the
// REST apiClient's baseURL.
//
// autoConnect is false — RealtimeProvider decides exactly when the
// connection starts (only once the user is authenticated), rather than
// connecting the instant this module is imported.
//
// This function is intentionally the ONLY place in the frontend allowed to
// call io(). RealtimeProvider is the only caller, and it owns the resulting
// socket's entire lifecycle — no other feature should ever construct its own
// socket. If a future feature needs to emit a client -> server event, add an
// explicit exported function to this module (or the provider) rather than
// reaching for io() directly.
export function createSocket(): Socket {
  return io(env.apiUrl, {
    withCredentials: true,
    autoConnect: false,
  });
}
