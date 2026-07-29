import { UserAvatar } from "@/components/ux";
import { formatRelativeDate } from "@/utils";

import { describeActivity } from "../lib/describe-activity";
import type { Activity } from "../types";

interface ActivityItemProps {
  activity: Activity;
}

// Presentational building block for a single activity entry. Feed-specific
// concerns (selection, navigation, hover/interactive chrome) belong to the
// consuming feature - this only renders what an activity entry looks like.
export function ActivityItem({ activity }: ActivityItemProps) {
  const { action, entity } = describeActivity(activity);

  return (
    <div className="flex items-start gap-3">
      <UserAvatar name={activity.actor.name} image={activity.actor.image} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="min-w-0 text-sm leading-5">
          <span className="font-medium">{activity.actor.name}</span>{" "}
          <span className="text-muted-foreground">{action}</span>
        </p>

        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {entity ? (
            <>
              <span className="truncate">{entity}</span>
              <span className="select-none">•</span>
            </>
          ) : null}
          <time className="shrink-0">{formatRelativeDate(activity.createdAt)}</time>
        </div>
      </div>
    </div>
  );
}
