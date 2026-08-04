import type { QueryClient } from "@tanstack/react-query";

import type { RealtimeEvent } from "./realtime-events";

export type RealtimeHandler = (payload: unknown, queryClient: QueryClient) => void;

/**
 * The single place every realtime-reactive feature plugs into.
 * RealtimeProvider iterates this table and registers exactly one
 * socket.on(...) per entry — no feature should ever call socket.on directly.
 *
 * Empty for now: this commit is infrastructure only. Later commits add one
 * entry per event here, each importing that feature's own query-key module
 * to call invalidateQueries — never setQueryData (see PR #58 architecture
 * decisions: realtime never owns data, it only tells React Query something
 * changed).
 */
export const realtimeHandlers: Partial<Record<RealtimeEvent, RealtimeHandler>> = {};
