import { UserAvatar } from "@/components/ux";
import { cn, formatRelativeDate } from "@/utils";

import { describeActivity } from "../lib/describe-activity";
import type { Activity } from "../types";

interface ActivityItemProps {
  activity: Activity;
}

// Presentational building block for a single activity entry. Feed-specific
// concerns (selection, navigation, hover/interactive chrome) belong to the
// consuming feature - this only renders what an activity entry looks like.
// Read-only, so the row gets a hover highlight for scannability but no
// cursor-pointer/click affordance - there is nothing to click through to yet.
export function ActivityItem({ activity }: ActivityItemProps) {
  const { action, entity } = describeActivity(activity);

  // Only task entities are ever routable in this app today (see
  // RecentActivityPanel's resolveActivityHref - project routing needs a slug
  // the Activity contract doesn't expose yet), so only task entities get the
  // "this looks like a link" treatment. No href/onClick is wired up here -
  // this is presentational only, matching the future-navigation shape.
  const isEntityLinkable = entity !== null && activity.entityType === "TASK";

  return (
    <div className="flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-muted/40">
      <UserAvatar
        name={activity.actor.name}
        image={activity.actor.image}
        size="sm"
        shape="square"
      />

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-xs text-muted-foreground">{activity.actor.name}</p>

        <p className="truncate text-sm leading-5 font-medium text-foreground">{action}</p>

        <div className="flex items-center gap-1.5 text-xs">
          {entity ? (
            <>
              <span
                className={cn(
                  "truncate text-muted-foreground",
                  isEntityLinkable &&
                    "cursor-pointer underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline",
                )}
              >
                {entity}
              </span>
              <span className="select-none text-muted-foreground/50">&middot;</span>
            </>
          ) : null}
          <time className="shrink-0 text-muted-foreground/60">
            {formatRelativeDate(activity.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}
