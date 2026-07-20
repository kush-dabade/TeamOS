import type { TaskListItem } from "@/features/tasks/types";

import { MyTaskRow } from "./row";
import { MyTasksTableSkeleton } from "./skeleton";

interface MyTasksTableProps {
  tasks: TaskListItem[];
  isLoading: boolean;
  onSelectTask: (taskId: string) => void;
}

export function MyTasksTable({ tasks, isLoading, onSelectTask }: MyTasksTableProps) {
  return (
    <div className="overflow-x-auto">
      <table aria-busy={isLoading} className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">My tasks</caption>
        <thead className="border-b text-left text-xs font-medium text-muted-foreground">
          <tr>
            <th scope="col" className="w-[40%] px-3 py-2 font-medium">
              Task
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Project
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Due date
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Priority
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <MyTasksTableSkeleton />
          ) : (
            tasks.map((taskItem) => (
              <MyTaskRow key={taskItem.task.id} taskItem={taskItem} onSelect={onSelectTask} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
