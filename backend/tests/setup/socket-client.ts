import { io, type Socket } from "socket.io-client";

/**
 * Opens an authenticated Socket.IO connection using a real Better Auth
 * session cookie (see fixtures.ts's signUpTestUser) - the same header
 * authenticateSocket reads via fromNodeHeaders(socket.handshake.headers).
 *
 * Always forces a brand new Manager/transport (forceNew: true). Without
 * it, socket.io-client caches a Manager per URL, so a second io(baseUrl)
 * call for the same test would silently multiplex over the *same*
 * underlying connection instead of opening an independent one - the
 * server would only ever see a single `connection` event, which would
 * invalidate any test that opens multiple sockets for one user.
 */
export function connectTestSocket(baseUrl: string, cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      forceNew: true,
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie },
    });

    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => reject(error));
  });
}

/**
 * Resolves with the next occurrence of `event` on `socket`, or rejects if
 * it doesn't arrive within `timeoutMs`. The only wait mechanism used
 * anywhere in these tests - no sleeps.
 */
export function waitForEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${event}"`));
    }, timeoutMs);

    function handler(payload: T) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }

    socket.on(event, handler);
  });
}

/**
 * Confirms a socket actually joined its room(s) by retrying a broadcast
 * until it's observed, instead of a single wait. There's an inherent race
 * between the client's "connect" event (fired once the handshake
 * completes) and the server finishing its async joinWorkspaceRooms() call
 * - the client can see "connect" before the server has joined any rooms -
 * so the very first delivery check after a fresh connect/reconnect can't
 * assume the join already landed. Every other wait in these tests happens
 * after a connection has already been proven joined this way, so it has
 * no such race and uses plain waitForEvent instead.
 */
export async function waitForEventWithRetries<T = unknown>(
  socket: Socket,
  event: string,
  triggerEmit: () => void,
  { attempts = 10, attemptTimeoutMs = 200 }: { attempts?: number; attemptTimeoutMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    triggerEmit();

    try {
      return await waitForEvent<T>(socket, event, attemptTimeoutMs);
    } catch {
      if (attempt === attempts) {
        throw new Error(
          `"${event}" was not observed on socket ${socket.id} after ${attempts} attempts - the room join likely never completed`,
        );
      }
    }
  }

  /* c8 ignore next */
  throw new Error("unreachable");
}

/**
 * Registers a listener that flips a flag if `event` is ever received -
 * call this BEFORE triggering anything that could emit it, so there's no
 * window where a fast delivery could be missed. Returns a getter for the
 * flag and a cleanup function to remove the listener once the test is
 * done checking it.
 */
export function trackEvent(socket: Socket, event: string): { wasReceived: () => boolean; stop: () => void } {
  let received = false;

  function handler() {
    received = true;
  }

  socket.on(event, handler);

  return {
    wasReceived: () => received,
    stop: () => socket.off(event, handler),
  };
}
