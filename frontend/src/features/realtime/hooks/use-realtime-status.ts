import { useContext } from "react";

import { RealtimeContext } from "../providers/realtime-provider";

export function useRealtimeStatus() {
  const context = useContext(RealtimeContext);

  if (context === undefined) {
    throw new Error("useRealtimeStatus must be used within a RealtimeProvider");
  }

  return context;
}
