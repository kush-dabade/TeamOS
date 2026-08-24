import { ChevronRight } from "lucide-react";

import { getInitials, formatRelativeDate } from "@/utils";

import type { RecentActivityItem } from "../../types";

interface ActivityRowProps {
  item: RecentActivityItem;
  // Whether this activity resolves to a navigable destination. The panel owns
  // that decision; the row only renders a button vs. static row accordingly.
  interactive: boolean;
  onSelect: (item: RecentActivityItem) => void;
}

// Frontend-generated description for the MVP. Tasks, projects, and comments are
// described explicitly; every other type gets a neutral fallback so an
// unmapped backend enum value still renders. A backend presenter can replace
// this later without changing the row.
function describeActivity(item: RecentActivityItem): {
  action: string;
  entity: string | null;
} {
  const metadata = item.metadata ?? {};
  const taskTitle = typeof metadata.taskTitle === "string" ? metadata.taskTitle : null;
  const projectName = typeof metadata.projectName === "string" ? metadata.projectName : null;

  switch (item.type) {
    case "TASK_CREATED":
      return { action: "created a task", entity: taskTitle };
    case "TASK_STATUS_CHANGED":
      return { action: "updated a task", entity: taskTitle };
    case "TASK_COMPLETED":
      return { action: "completed a task", entity: taskTitle };
    case "TASK_DELETED":
      return { action: "deleted a task", entity: taskTitle };
    case "PROJECT_CREATED":
      return { action: "created a project", entity: projectName };
    case "PROJECT_UPDATED":
      return { action: "updated a project", entity: projectName };
    case "PROJECT_ARCHIVED":
      return { action: "archived a project", entity: projectName };
    case "PROJECT_RESTORED":
      return { action: "restored a project", entity: projectName };
    case "COMMENT_CREATED":
      return { action: "left a comment", entity: null };
    default:
      return { action: "updated an item", entity: null };
  }
}

export function ActivityRow({ item, interactive, onSelect }: ActivityRowProps) {
  const { action, entity } = describeActivity(item);

  const content = (
    <div className="flex items-start gap-3">
      {item.actor.image ? (
        <img src={item.actor.image} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
        >
          {getInitials(item.actor.name)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm leading-5">
            <span className="font-medium">{item.actor.name}</span>{" "}
            <span className="text-muted-foreground">{action}</span>
          </p>

          {interactive ? (
            <ChevronRight
              className="
                text-muted-foreground
                mt-0.5 h-3.5 w-3.5
                shrink-0
                opacity-0
                transition-all duration-150
                group-hover:translate-x-0.5
                group-hover:opacity-100
              "
            />
          ) : null}
        </div>

        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          {entity ? (
            <>
              <span className="truncate">{entity}</span>
              <span className="select-none">•</span>
            </>
          ) : null}
          <time className="shrink-0">{formatRelativeDate(item.createdAt)}</time>
        </div>
      </div>
    </div>
  );

  if (!interactive) {
    return <div className="px-2.5 py-2">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group hover:bg-muted/50 focus-visible:ring-ring w-full rounded-md px-2.5 py-2 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-hidden"
    >
      {content}
    </button>
  );
}
