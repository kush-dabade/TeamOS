import { SearchIcon } from "lucide-react";

import { Button, Input } from "@/components/ui";

import type {
  TaskAssignee,
  TaskPriorityFilter,
  TaskProject,
  TaskStatusFilter,
} from "../../types";

interface TasksToolbarProps {
  searchQuery: string;
  statusFilter: TaskStatusFilter;
  priorityFilter: TaskPriorityFilter;
  projectFilter: string;
  assigneeFilter: string;
  projects: TaskProject[];
  assignees: TaskAssignee[];
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: TaskStatusFilter) => void;
  onPriorityFilterChange: (value: TaskPriorityFilter) => void;
  onProjectFilterChange: (value: string) => void;
  onAssigneeFilterChange: (value: string) => void;
  onCreateTask: (trigger: HTMLButtonElement) => void;
}

export function TasksToolbar({
  searchQuery,
  statusFilter,
  priorityFilter,
  projectFilter,
  assigneeFilter,
  projects,
  assignees,
  onSearchQueryChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onProjectFilterChange,
  onAssigneeFilterChange,
  onCreateTask,
}: TasksToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div className="relative min-w-0 sm:min-w-64 sm:flex-1">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search tasks..."
          aria-label="Search tasks"
          className="pl-8"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as TaskStatusFilter)}
          aria-label="Filter tasks by status"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto dark:bg-input/30"
        >
          <option value="ALL">All Statuses</option>
          <option value="TODO">Todo</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="REVIEW">Review</option>
          <option value="DONE">Done</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => onPriorityFilterChange(event.target.value as TaskPriorityFilter)}
          aria-label="Filter tasks by priority"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto dark:bg-input/30"
        >
          <option value="ALL">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select
          value={projectFilter}
          onChange={(event) => onProjectFilterChange(event.target.value)}
          aria-label="Filter tasks by project"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto dark:bg-input/30"
        >
          <option value="ALL">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          value={assigneeFilter}
          onChange={(event) => onAssigneeFilterChange(event.target.value)}
          aria-label="Filter tasks by assignee"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto dark:bg-input/30"
        >
          <option value="ALL">All Assignees</option>
          <option value="UNASSIGNED">Unassigned</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="button"
        className="w-full sm:ml-auto sm:w-auto"
        onClick={(event) => onCreateTask(event.currentTarget)}
      >
        Create Task
      </Button>
    </div>
  );
}
