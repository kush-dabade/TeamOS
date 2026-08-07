import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import { formatDate, formatRelativeDate } from "@/utils";
import type { Task } from "@/features/tasks";

import { SprintStatusBadge } from "../SprintStatusBadge";

import { SprintTaskList } from "./SprintTaskList";

import type { Sprint } from "../../types";

interface SprintPreviewPanelProps {
  sprint: Sprint | null;
  open: boolean;
  isStarting: boolean;
  isCompleting: boolean;
  sprintTasks: Task[];
  isSprintTasksLoading: boolean;
  isSprintTasksError: boolean;
  removingTaskId: string | null;
  onRetrySprintTasks: () => void;
  onRemoveTask: (taskId: string) => void;
  onAssignTask: () => void;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
}

// Mirrors ProjectPreviewPanel's shape (inline dl, not a shared "properties"
// component like TaskPreviewPanel's TaskProperties) - Sprint has no
// standalone workspace page to share a properties block with, and its field
// set is small and flat like Project's. The right-hand footer slot that
// Project/Task use for "Open project"/"Open task" instead holds the
// status-conditional lifecycle action, since Sprint has no destination page.
export function SprintPreviewPanel({
  sprint,
  open,
  isStarting,
  isCompleting,
  sprintTasks,
  isSprintTasksLoading,
  isSprintTasksError,
  removingTaskId,
  onRetrySprintTasks,
  onRemoveTask,
  onAssignTask,
  onClose,
  onCloseAutoFocus,
  onEdit,
  onStart,
  onComplete,
}: SprintPreviewPanelProps) {
  if (!sprint) {
    return null;
  }

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
          <SheetTitle>{sprint.name}</SheetTitle>
          <SprintStatusBadge status={sprint.status} className="w-fit" />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {sprint.goal ? (
            <p className="text-sm leading-6 text-muted-foreground">{sprint.goal}</p>
          ) : null}

          <dl className={sprint.goal ? "mt-5 space-y-3" : "space-y-3"}>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Start</dt>
              <dd className="text-sm font-medium">
                {sprint.startDate ? formatDate(sprint.startDate, "MMM d, yyyy") : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">End</dt>
              <dd className="text-sm font-medium">
                {sprint.endDate ? formatDate(sprint.endDate, "MMM d, yyyy") : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Updated</dt>
              <dd className="text-sm font-medium">{formatRelativeDate(sprint.updatedAt)}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Tasks</h3>
              <Button type="button" variant="outline" onClick={onAssignTask}>
                Assign task
              </Button>
            </div>

            <div className="mt-2">
              <SprintTaskList
                tasks={sprintTasks}
                isLoading={isSprintTasksLoading}
                isError={isSprintTasksError}
                onRetry={onRetrySprintTasks}
                onAssignTask={onAssignTask}
                removingTaskId={removingTaskId}
                onRemove={onRemoveTask}
              />
            </div>
          </div>
        </div>

        <Separator />

        <SheetFooter className="flex-row items-center justify-between p-4">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          </div>

          {sprint.status === "PLANNED" ? (
            <Button type="button" onClick={onStart} disabled={isStarting}>
              {isStarting ? "Starting..." : "Start sprint"}
            </Button>
          ) : null}

          {sprint.status === "ACTIVE" ? (
            <Button type="button" onClick={onComplete} disabled={isCompleting}>
              {isCompleting ? "Completing..." : "Complete sprint"}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
