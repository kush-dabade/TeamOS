import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth";

import { createSocket } from "../lib/socket-client";
import type { RealtimeConnectionStatus, RealtimeContextValue } from "../types";

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

/**
 * Sole owner of the Socket.IO client for the whole app. No other module
 * should ever call io() directly, and the socket instance itself is never
 * exposed outside this file (only connection status, via context) — future
 * client emits should get an explicit exported function here instead of a
 * leaked socket handle.
 *
 * Mounted once, above the router, so connect/disconnect only happens on
 * actual login/logout transitions rather than on route navigation.
 */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();

  // Raw signal from the socket itself, updated only from inside its own
  // event callbacks (never set synchronously in the effect body — that
  // trips react-hooks/set-state-in-effect, the same rule WorkspaceProvider
  // works around elsewhere). "connecting" is derived below, not stored.
  const [rawStatus, setRawStatus] = useState<"connected" | "disconnected">("disconnected");

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const socket = createSocket();

    const handleConnect = () => setRawStatus("connected");
    const handleDisconnect = () => setRawStatus("disconnected");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    socket.connect();

    return () => {
      // Disconnect before detaching listeners so the socket's own
      // client-initiated "disconnect" event still fires handleDisconnect,
      // resetting rawStatus — otherwise a stale "connected" could survive
      // into the next login (e.g. a fast logout/login cycle).
      socket.disconnect();

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
    };
  }, [isAuthenticated]);

  const status = useMemo<RealtimeConnectionStatus>(() => {
    if (!isAuthenticated) {
      return "disconnected";
    }

    return rawStatus === "connected" ? "connected" : "connecting";
  }, [isAuthenticated, rawStatus]);

  const value = useMemo<RealtimeContextValue>(() => ({ status }), [status]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export { RealtimeContext };
