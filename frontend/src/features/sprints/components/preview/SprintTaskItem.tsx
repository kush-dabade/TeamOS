import { XIcon } from "lucide-react";

import { Button } from "@/components/ui";
import { TaskStatusBadge } from "@/features/tasks/components/TaskStatusBadge";
import type { Task } from "@/features/tasks";

import type { SprintStatus } from "../../types";

interface SprintTaskItemProps {
  task: Task;
  isRemoving: boolean;
  onRemove: () => void;
  sprintStatus: SprintStatus;
}

// Removing a task from a sprint just unassigns it (fully reversible via
// Assign task again) - unlike AttachmentItem's delete, this isn't
// destructive, so it's a direct action button, not a confirm dialog.
export function SprintTaskItem({
  task,
  isRemoving,
  onRemove,
  sprintStatus,
}: SprintTaskItemProps) {
  return (
    <div className="group/sprint-task flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-muted/40">
      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
      <TaskStatusBadge status={task.status} />
      {sprintStatus === "COMPLETED" ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${task.title} from sprint`}
          onClick={onRemove}
          disabled={isRemoving}
          className="opacity-0 transition-opacity duration-150 group-hover/sprint-task:opacity-100 group-focus-within/sprint-task:opacity-100"
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
