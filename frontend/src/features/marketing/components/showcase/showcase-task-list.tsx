import { UserAvatar } from "@/components/ux";
import { TaskPriorityBadge } from "@/features/tasks/components/TaskPriorityBadge";
import { TaskStatusBadge } from "@/features/tasks/components/TaskStatusBadge";

import { showcaseTasks } from "./showcase-data";

export function ShowcaseTaskList() {
  return (
    <ul className="divide-y divide-border">
      {showcaseTasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</p>

          <div className="flex shrink-0 items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} className="hidden sm:inline-flex" />

            {task.assignee ? (
              <UserAvatar name={task.assignee.name} image={null} size="sm" shape="square" />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
