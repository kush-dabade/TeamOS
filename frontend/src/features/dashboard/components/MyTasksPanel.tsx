import { DashboardPanel } from "./layout";
import { TaskRow } from "./task-row";

import { mockTasks } from "../data/dashboard.mock";

export function MyTasksPanel() {
  return (
    <DashboardPanel
      title="My Tasks"
      description="Tasks that need your attention."
    >
      <div className="divide-border divide-y">
        {mockTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </DashboardPanel>
  );
}