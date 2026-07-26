import { CalendarClock, ChevronRight, Eye, type LucideIcon } from "lucide-react";

import type { AttentionItemKind, WorkspaceAttentionItem } from "../../types";
import { cn, formatRelativeDate } from "@/utils";

interface WorkspaceAttentionRowProps {
  item: WorkspaceAttentionItem;
  onSelect: (item: WorkspaceAttentionItem) => void;
}

interface AttentionKindConfig {
  icon: LucideIcon;
  label: string;
  foreground: string;
  background: string;
}

// Presentation is derived from `kind` so the domain model stays free of icons
// and colors. Order here also reflects severity (most severe first).
const kindConfig: Record<AttentionItemKind, AttentionKindConfig> = {
  OVERDUE_TASK: {
    icon: CalendarClock,
    label: "Overdue",
    foreground: "text-destructive",
    background: "bg-destructive/10",
  },
  PENDING_REVIEW: {
    icon: Eye,
    label: "Pending review",
    foreground: "text-warning",
    background: "bg-warning/10",
  },
};

export function WorkspaceAttentionRow({ item, onSelect }: WorkspaceAttentionRowProps) {
  const config = kindConfig[item.kind];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="
        group w-full
        rounded-md
        px-2.5 py-2
        text-left
        transition-colors duration-150
        hover:bg-muted/50
        focus-visible:outline-hidden
        focus-visible:ring-2
        focus-visible:ring-ring
      "
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            config.background,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", config.foreground)} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-medium leading-5">{item.title}</span>

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
          </div>

          <div className="mt-0.5 flex min-h-5 items-center gap-1.5 text-xs">
            <span className={cn("shrink-0 font-medium", config.foreground)}>{config.label}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate">{item.context}</span>
            <span className="text-muted-foreground ml-auto shrink-0 whitespace-nowrap">
              {formatRelativeDate(item.occurredAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
