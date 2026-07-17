import type { Task } from "../types";

interface TaskOverviewProps {
  task: Task;
}

export function TaskOverview({ task }: TaskOverviewProps) {
  return (
    <p className="text-sm leading-6 text-muted-foreground">
      {task.description ?? "No description provided."}
    </p>
  );
}
