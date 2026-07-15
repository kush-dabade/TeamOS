import { ChevronRight } from "lucide-react";

import type { WorkspaceHealthItem } from "../../types";

interface HealthItemProps {
  item: WorkspaceHealthItem;
}

const toneClasses = {
  healthy: {
    icon: "text-emerald-600",
    state: "text-emerald-600",
    background: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  warning: {
    icon: "text-amber-600",
    state: "text-amber-600",
    background: "bg-amber-50 dark:bg-amber-950/30",
  },
  neutral: {
    icon: "text-muted-foreground",
    state: "text-foreground",
    background: "bg-muted",
  },
} satisfies Record<
  WorkspaceHealthItem["tone"],
  {
    icon: string;
    state: string;
    background: string;
  }
>;

export function HealthItem({ item }: HealthItemProps) {
  const Icon = item.icon;
  const tone = toneClasses[item.tone];

  return (
    <button
      type="button"
      className="
        group w-full
        rounded-md
        px-2.5 py-2
        text-left
        transition-colors duration-150
        hover:bg-muted/50
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-ring
      "
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            ${tone.background}
            flex h-6 w-6 shrink-0 items-center justify-center rounded-md
            transition-colors duration-150
            group-hover:bg-background
          `}
        >
          <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
        </div>

        <div className="flex min-w-0 flex-1 items-center">
          <span className="truncate text-sm font-medium">{item.label}</span>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
              className={`
                whitespace-nowrap
                text-xs
                font-medium
                ${tone.state}
              `}
            >
              {item.state}
            </span>

            <ChevronRight
              className="
                text-muted-foreground
                h-3.5 w-3.5
                opacity-0
                transition-all duration-150
                group-hover:translate-x-0.5
                group-hover:opacity-100
              "
            />
          </div>
        </div>
      </div>
    </button>
  );
}
