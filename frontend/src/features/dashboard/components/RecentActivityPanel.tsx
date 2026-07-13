import { DashboardPanel } from "./layout";
import { ActivityItem } from "./recent-activity";

import { mockActivities } from "../data/dashboard.mock";

export function RecentActivityPanel() {
  return (
    <DashboardPanel title="Recent Activity" description="Latest updates across your workspace.">
      <div className="divide-border divide-y">
        {mockActivities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </DashboardPanel>
  );
}
