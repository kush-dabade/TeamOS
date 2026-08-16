import { ListTodo, SearchX, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/ux";

import type { TaskListItem } from "../../types";

import { TaskRow } from "./TaskRow";
import { TasksTableSkeleton } from "./TasksTableSkeleton";

interface TasksTableProps {
  tasks: TaskListItem[];
  selectedTaskId: string | null;
  isLoading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  showProjectColumn?: boolean;
  onTaskSelect: (taskId: string, trigger: HTMLButtonElement | null) => void;
  // Optional so callers without create permission can omit it entirely,
  // hiding every create affordance (empty state and persistent header) - the
  // same optional-handler convention as onClearFilters below.
  onCreateTask?: (trigger: HTMLButtonElement) => void;
  onRetry: () => void;
  // Optional: only meaningful (and only rendered) when hasActiveFilters is
  // true. Callers that never set hasActiveFilters, like ProjectTasks, don't
  // need to pass a handler that can never be invoked.
  onClearFilters?: () => void;
}

export function TasksTable({
  tasks,
  selectedTaskId,
  isLoading,
  error,
  hasActiveFilters,
  showProjectColumn = true,
  onTaskSelect,
  onCreateTask,
  onRetry,
  onClearFilters,
}: TasksTableProps) {
  if (error) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <ErrorState
          icon={TriangleAlert}
          title="Unable to load tasks"
          description="Something went wrong while loading tasks. Check your connection and try again."
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!isLoading && tasks.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        {hasActiveFilters && onClearFilters ? (
          <EmptyState
            icon={SearchX}
            title="No tasks match your filters"
            description="Try adjusting your search, status, or other filters."
            action={
              <Button type="button" variant="outline" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Create a task to start organizing work."
            action={
              onCreateTask ? (
                <Button type="button" onClick={(event) => onCreateTask(event.currentTarget)}>
                  Create task
                </Button>
              ) : undefined
            }
          />
        )}
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
            {showProjectColumn ? (
              <th scope="col" className="w-40 px-3 py-2 font-medium">Project</th>
            ) : null}
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
                  showProjectColumn={showProjectColumn}
                  onSelect={onTaskSelect}
                />
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
}
