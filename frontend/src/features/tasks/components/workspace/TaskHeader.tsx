import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/ui";
import { formatDate } from "@/utils";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";

import type { TaskListItem } from "../../types";

interface TaskHeaderProps {
  taskItem: TaskListItem;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: () => void | Promise<void>;
  isDeleting: boolean;
}

export function TaskHeader({ taskItem, onEdit, onDelete, isDeleting }: TaskHeaderProps) {
  const { assignee, project, task } = taskItem;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <header className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-semibold tracking-tight">{task.title}</h1>

        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
          {task.description ?? "No description provided."}
        </p>

        <div className="mt-3 overflow-x-auto">
          <div className="flex w-max items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <span aria-hidden="true">•</span>
            <span>{assignee?.name ?? "Unassigned"}</span>
            <span aria-hidden="true">•</span>
            <span>{project.name}</span>
            <span aria-hidden="true">•</span>
            <span>{task.sprintId ?? "No sprint"}</span>
            <span aria-hidden="true">•</span>
            <span>{task.dueDate ? formatDate(task.dueDate, "MMM d") : "No due date"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={(event) => onEdit(event.currentTarget)}>
          Edit task
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete task"}
        </Button>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{task.title}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={async (event) => {
                // Prevent Radix's default auto-close so the dialog stays
                // open (both actions disabled) for the duration of the
                // delete instead of closing into a state that looks
                // finished while the mutation is still in flight. onDelete
                // already catches its own errors, so this always settles.
                event.preventDefault();
                await onDelete();
                setIsConfirmOpen(false);
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
