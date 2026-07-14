import { DashboardPanel } from "./layout";
import { FocusItem } from "./focus-item";

import { mockTasks } from "../data/dashboard.mock";

export function TodaysFocusPanel() {
  return (
    <DashboardPanel
      title="Today's Focus"
      description="The highest-priority work that needs your attention today."
      action={
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          View all
        </button>
      }
    >
      <div className="divide-border divide-y">
        {mockTasks.map((task) => (
          <FocusItem key={task.id} task={task} />
        ))}
      </div>
    </DashboardPanel>
  );
}