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
  Separator,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";
import { TaskProperties } from "../TaskProperties";

import type { TaskAssignee, TaskListItem } from "../../types";

interface TaskPreviewPanelProps {
  taskItem: TaskListItem | null;
  createdBy: TaskAssignee | null;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onOpenTask: (taskId: string) => void;
  onEdit: () => void;
  // Optional so existing consumers that don't pass it (e.g. TasksPage today)
  // render exactly as before - no delete button, no confirmation dialog.
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function TaskPreviewPanel({
  taskItem,
  createdBy,
  open,
  onClose,
  onCloseAutoFocus,
  onOpenTask,
  onEdit,
  onDelete,
  isDeleting = false,
}: TaskPreviewPanelProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!taskItem) {
    return null;
  }

  const { task } = taskItem;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[440px] gap-0 p-0 sm:max-w-[440px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle>{task.title}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {task.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{task.description}</p>
          ) : null}

          <div className={task.description ? "mt-5" : undefined}>
            <TaskProperties taskItem={taskItem} createdBy={createdBy} showTimestamps={false} />
          </div>
        </div>

        <Separator />

        <SheetFooter className="flex-row items-center justify-between p-4">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsConfirmOpen(true)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
          </div>
          <Button type="button" onClick={() => onOpenTask(task.id)}>
            Open task
          </Button>
        </SheetFooter>
      </SheetContent>

      {onDelete ? (
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
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onDelete();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </Sheet>
  );
}
