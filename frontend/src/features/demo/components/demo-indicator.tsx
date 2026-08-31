import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/utils";

import { useDemoStatus } from "../hooks/use-demo-status";

// Re-renders the relative-time label periodically so it doesn't visibly go
// stale across a multi-hour demo session - purely a local re-render tick,
// never a network request (demoExpiresAt itself is a fixed timestamp
// already known from the session).
const LABEL_REFRESH_INTERVAL_MS = 60_000;

export function DemoIndicator() {
  const { isDemo, expiresAt } = useDemoStatus();
  // `now`, not a bare re-render counter: reading Date.now() directly during
  // render is an impure call React's rules flag (react-hooks/purity) - the
  // lazy useState initializer and the interval callback below are the only
  // two places that actually read the clock, both outside render itself.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isDemo) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), LABEL_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isDemo]);

  // Disappears entirely for normal users - not just visually hidden.
  if (!isDemo) {
    return null;
  }

  const isExpired = expiresAt !== null && expiresAt.getTime() <= now;
  const expiryLabel =
    expiresAt && !isExpired ? `expires ${formatRelativeDate(expiresAt)}` : "expiring soon";

  return (
    <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:flex">
      <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
      <span>Demo workspace · {expiryLabel}</span>

      <Button asChild size="xs" variant="outline" className="h-5 px-2 text-[11px]">
        <Link to="/register">Sign up</Link>
      </Button>
    </div>
  );
}
