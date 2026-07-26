import { SearchIcon } from "lucide-react";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

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
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as TaskStatusFilter)}
        >
          <SelectTrigger aria-label="Filter tasks by status" className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="TODO">Todo</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="REVIEW">Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(value) => onPriorityFilterChange(value as TaskPriorityFilter)}
        >
          <SelectTrigger aria-label="Filter tasks by priority" className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All Priorities</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={onProjectFilterChange}>
          <SelectTrigger aria-label="Filter tasks by project" className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={onAssigneeFilterChange}>
          <SelectTrigger aria-label="Filter tasks by assignee" className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All Assignees</SelectItem>
              <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
              {assignees.map((assignee) => (
                <SelectItem key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        className="w-full sm:ml-auto sm:w-auto"
        onClick={(event) => onCreateTask(event.currentTarget)}
      >
        Create task
      </Button>
    </div>
  );
}
