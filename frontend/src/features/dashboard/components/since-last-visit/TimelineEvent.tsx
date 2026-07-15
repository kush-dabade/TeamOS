import type { DashboardEvent } from "../../types";

interface TimelineEventProps {
  event: DashboardEvent;
  onClick?: () => void;
}

const toneClasses = {
  default: {
    icon: "text-muted-foreground",
    background: "bg-muted",
  },
  success: {
    icon: "text-emerald-600",
    background: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  warning: {
    icon: "text-amber-600",
    background: "bg-amber-50 dark:bg-amber-950/30",
  },
} satisfies Record<
  DashboardEvent["tone"],
  {
    icon: string;
    background: string;
  }
>;

export function TimelineEvent({ event, onClick }: TimelineEventProps) {
  const Icon = event.icon;
  const tone = toneClasses[event.tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group w-full
        rounded-md
        px-3 py-2.5
        text-left
        transition-colors duration-150
        hover:bg-muted/50
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-ring
      "
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            ${tone.background}
            flex h-8 w-8 shrink-0 items-center justify-center rounded-md
            transition-colors duration-150
            group-hover:bg-background
          `}
        >
          <Icon className={`h-4 w-4 ${tone.icon}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="
              truncate
              text-sm
              font-medium
              leading-5
              transition-colors
              group-hover:text-foreground
            "
          >
            {event.title}
          </p>

          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
            <span className="truncate">{event.context}</span>

            <span className="select-none">•</span>

            <time className="shrink-0">{event.timestamp}</time>
          </div>
        </div>
      </div>
    </button>
  );
}
