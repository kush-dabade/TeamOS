import { Button } from "@/components/ui";

import type { TaskListItem } from "../../types";

import { TaskRow } from "./TaskRow";
import { TasksTableSkeleton } from "./TasksTableSkeleton";

interface TasksTableProps {
  tasks: TaskListItem[];
  selectedTaskId: string | null;
  isLoading: boolean;
  onTaskSelect: (taskId: string, trigger: HTMLButtonElement | null) => void;
  onCreateTask: (trigger: HTMLButtonElement) => void;
}

export function TasksTable({
  tasks,
  selectedTaskId,
  isLoading,
  onTaskSelect,
  onCreateTask,
}: TasksTableProps) {
  if (!isLoading && tasks.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="text-sm text-muted-foreground">Create a task to start organizing work.</p>
        <Button type="button" className="mt-2" onClick={(event) => onCreateTask(event.currentTarget)}>
          Create Task
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table aria-busy={isLoading} className="min-w-[960px] w-full border-collapse text-sm">
        <caption className="sr-only">Tasks</caption>
        <thead className="sticky top-0 z-10 border-b bg-background/95 text-left text-xs font-medium text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="w-[30%] px-3 py-2 font-medium">Task</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Status</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Priority</th>
            <th scope="col" className="w-40 px-3 py-2 font-medium">Assignee</th>
            <th scope="col" className="w-40 px-3 py-2 font-medium">Project</th>
            <th scope="col" className="w-32 px-3 py-2 font-medium">Due Date</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <TasksTableSkeleton /> : null}
          {!isLoading
            ? tasks.map((taskItem) => (
                <TaskRow
                  key={taskItem.task.id}
                  taskItem={taskItem}
                  isSelected={taskItem.task.id === selectedTaskId}
                  onSelect={onTaskSelect}
                />
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
}
