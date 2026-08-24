import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { CommandItem } from "@/components/ui";
import { TaskPriorityBadge } from "@/features/tasks/components/TaskPriorityBadge";
import { TaskStatusBadge } from "@/features/tasks/components/TaskStatusBadge";
import type { TaskPriority, TaskStatus } from "@/features/tasks";

interface SearchResultItemProps {
  value: string;
  icon?: LucideIcon;
  avatar?: ReactNode;
  title: string;
  description: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  onSelect: () => void;
}

// TaskStatusBadge/TaskPriorityBadge own the canonical status/priority labels
// privately (unexported statusLabels/priorityLabels maps) - this doesn't
// import or duplicate those maps, it independently derives the same text
// ("IN_PROGRESS" -> "In Progress") so the accessible name below can describe
// what the badges show without reaching into those components.
function humanizeEnumValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Deliberately dumb/presentational - it doesn't know whether it's rendering
// a project, task, sprint, or person, only whether it was given status/
// priority to show and whether it was given an icon or an avatar to lead
// with. SearchCommand picks the leading visual and the navigation target
// per result type; this just lays the row out. Project/sprint rows pass
// `icon`; people rows pass `avatar` (a UserAvatar) instead, since a person
// is identified by their picture, not a category glyph - exactly one of the
// two is ever passed for a given result type. Project/sprint rows never
// pass status/priority, so the badges simply don't render for them.
//
// `value` is an explicit, stable identifier (not derived from title text) -
// cmdk uses it to key keyboard highlighting/selection, and relying on its
// text-content fallback would break if two different result types ever
// shared a name.
export function SearchResultItem({
  value,
  icon: Icon,
  avatar,
  title,
  description,
  status,
  priority,
  onSelect,
}: SearchResultItemProps) {
  // Status/priority are only appended when they're actually rendered below
  // (status && priority), so the accessible name never claims something
  // sighted users can't also see - and title/description keep producing the
  // exact same string as before when neither is present.
  const statusPriorityParts =
    status && priority
      ? [`Status: ${humanizeEnumValue(status)}`, `Priority: ${humanizeEnumValue(priority)}`]
      : [];
  const ariaLabel = [title, description, ...statusPriorityParts].filter(Boolean).join(". ");

  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      aria-label={ariaLabel}
      className="items-start gap-2.5 py-2"
    >
      {avatar ??
        (Icon ? (
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null)}
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
