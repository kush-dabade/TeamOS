import { ActivityItem } from "@/features/activity";

import { showcaseActivities } from "./showcase-data";

export function ShowcaseActivityFeed() {
  return (
    <div className="space-y-0.5">
      {showcaseActivities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
