import type { LucideIcon } from "lucide-react";

import { CommandItem } from "@/components/ui";
import { TaskPriorityBadge } from "@/features/tasks/components/TaskPriorityBadge";
import { TaskStatusBadge } from "@/features/tasks/components/TaskStatusBadge";
import type { TaskPriority, TaskStatus } from "@/features/tasks";

interface SearchResultItemProps {
  value: string;
  icon: LucideIcon;
  title: string;
  description: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  onSelect: () => void;
}

// Deliberately dumb/presentational - it doesn't know whether it's rendering
// a project or a task, only whether it was given status/priority to show.
// SearchCommand picks the icon and the navigation target per result type;
// this just lays the row out. Project rows never pass status/priority, so
// the badges simply don't render for them.
//
// `value` is an explicit, stable identifier (not derived from title text) -
// cmdk uses it to key keyboard highlighting/selection, and relying on its
// text-content fallback would break if a project and a task ever shared a
// name.
export function SearchResultItem({
  value,
  icon: Icon,
  title,
  description,
  status,
  priority,
  onSelect,
}: SearchResultItemProps) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      aria-label={description ? `${title}. ${description}` : title}
      className="items-start gap-2.5 py-2"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{title}</span>
        {description ? (
          <span className="truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
      {status && priority ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <TaskStatusBadge status={status} />
          <TaskPriorityBadge priority={priority} />
        </div>
      ) : null}
    </CommandItem>
  );
}
