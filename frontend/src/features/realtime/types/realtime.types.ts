export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeContextValue {
  status: RealtimeConnectionStatus;
}
