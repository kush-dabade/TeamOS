import { createContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { useWorkspaceList } from "@/features/workspaces";

import { createSocket } from "../lib/socket-client";
import { realtimeHandlers } from "../lib/realtime-handlers";
import type { RealtimeEvent } from "../lib/realtime-events";
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
  const queryClient = useQueryClient();

  // useWorkspaceList() has no useContext dependency (it's a plain useQuery
  // wrapper), so it can be called from here even though WorkspaceContext
  // itself lives further down the tree, inside the router — RealtimeProvider
  // never needs to move, and never needs WorkspaceContext directly. TanStack
  // Query dedupes this against WorkspaceProvider's own call to the same
  // query key, so this adds no extra network request. `isAuthenticated` is
  // passed explicitly so this doesn't fire an unauthenticated request (and a
  // resulting console 401) while sitting on /login, before WorkspaceProvider
  // ever mounts.
  const workspacesQuery = useWorkspaceList(isAuthenticated);

  // Raw signal from the socket itself, updated only from inside its own
  // event callbacks (never set synchronously in the effect body — that
  // trips react-hooks/set-state-in-effect, the same rule WorkspaceProvider
  // works around elsewhere). "connecting" is derived below, not stored.
  const [rawStatus, setRawStatus] = useState<"connected" | "disconnected">("disconnected");

  // Owned exclusively by the connection-lifecycle effect below, which is the
  // only code that ever creates or destroys a socket. The membership-change
  // effect further down only ever reads this ref to reuse the existing
  // instance — it never constructs one.
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

  // The workspace-id set last observed by the membership-change effect.
  // `undefined` means "not observed yet this session" — distinct from an
  // empty Set, which means "observed, and this user genuinely belongs to
  // zero workspaces." Reset on logout (in the connection effect's cleanup)
  // so a later login treats its first observation as initial again, not as
  // a change from whatever the previous session happened to have.
  const previousWorkspaceIdsRef = useRef<Set<string> | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const socket = createSocket();
    socketRef.current = socket;

    const handleConnect = () => setRawStatus("connected");
    const handleDisconnect = () => setRawStatus("disconnected");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    // Centralized handler registry: one socket.on(...) per entry, registered
    // here and nowhere else in the app. `realtimeHandlers` is empty as of
    // this commit — feature wiring lands in later commits, each adding one
    // entry rather than a new socket.on(...) call site. The same socket
    // instance survives Socket.IO's own reconnects internally, so these
    // registrations don't need to be redone on reconnect.
    //
    // Object.entries widens a Partial<Record<K, V>>'s values to `V`, since it
    // can't express "only present keys are included" — the cast back to
    // RealtimeEvent/RealtimeHandler pairs is safe because Object.entries only
    // ever yields keys that are actually present in the object.
    const registeredHandlers = (
      Object.entries(realtimeHandlers) as [
        RealtimeEvent,
        (typeof realtimeHandlers)[RealtimeEvent],
      ][]
    ).map(([event, handler]) => {
      const listener = (payload: unknown) => handler?.(payload, queryClient);

      socket.on(event, listener);

      return { event, listener };
    });

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

      registeredHandlers.forEach(({ event, listener }) => {
        socket.off(event, listener);
      });

      socketRef.current = null;
      // Reset so a later login's first membership observation is treated as
      // initial again, rather than being compared against whatever the
      // previous session happened to have.
      previousWorkspaceIdsRef.current = undefined;
    };
  }, [isAuthenticated, queryClient]);

  // Membership-change reconnect: the backend only snapshots which workspace
  // rooms a socket joins once, at connect time (see
  // backend/src/realtime/realtime.server.ts's joinWorkspaceRooms). If the
  // user's own membership set changes afterward — they accept an invitation,
  // leave a workspace, or create a new one — the already-connected socket is
  // still sitting in the *old* set of rooms until something forces a fresh
  // handshake. Every one of those three actions already invalidates
  // workspaceKeys.list() in its own mutation hook's onSuccess, so this effect
  // only has to watch that query's data for a real change in the *set* of
  // workspace ids and reconnect the existing socket when it sees one.
  //
  // Deliberately not handled here: ownership transfer (role changes only,
  // the member's own room membership is unaffected) and member removal (the
  // backend currently emits no event to the removed user at all — see the
  // Commit 5 cache-invalidation audit — so there is nothing for this effect
  // to react to; that remains a documented backend follow-up, not something
  // this commit can work around from the client).
  useEffect(() => {
    if (!isAuthenticated || !workspacesQuery.data) {
      return;
    }

    const currentWorkspaceIds = new Set(workspacesQuery.data.map((workspace) => workspace.id));
    const previousWorkspaceIds = previousWorkspaceIdsRef.current;

    if (previousWorkspaceIds === undefined) {
      // First observation this session — this is the snapshot the socket's
      // own initial connect already reflects, not a change to react to.
      previousWorkspaceIdsRef.current = currentWorkspaceIds;
      return;
    }

    const isSameMembership =
      previousWorkspaceIds.size === currentWorkspaceIds.size &&
      [...previousWorkspaceIds].every((id) => currentWorkspaceIds.has(id));

    if (!isSameMembership) {
      socketRef.current?.disconnect();
      socketRef.current?.connect();
    }

    previousWorkspaceIdsRef.current = currentWorkspaceIds;
  }, [isAuthenticated, workspacesQuery.data]);

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
