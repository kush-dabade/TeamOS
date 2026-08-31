import { Layers3 } from "lucide-react";

import { SprintStatusBadge } from "@/features/sprints/components/SprintStatusBadge";

import { showcaseSprint } from "./showcase-data";
import { ShowcaseActivityFeed } from "./showcase-activity-feed";
import { ShowcaseProjectList } from "./showcase-project-list";
import { ShowcaseTaskList } from "./showcase-task-list";

/**
 * A read-only "window into TeamOS" built entirely from real feature
 * components (badges, UserAvatar, ActivityItem) fed static showcase data —
 * not a fabricated screenshot. No API calls, no auth, no server state.
 */
export function ProductShowcaseFrame() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Layers3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-muted-foreground">
            TeamOS · Website Redesign
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {showcaseSprint.name}
          </span>
          <SprintStatusBadge status={showcaseSprint.status} />
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[220px_1fr_260px] lg:gap-8">
        <div className="border-b border-border pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Projects
          </p>
          <ShowcaseProjectList />
        </div>

        <div className="border-b border-border pb-6 lg:border-b-0 lg:pb-0">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Tasks
          </p>
          <ShowcaseTaskList />
        </div>

        <div className="lg:border-l lg:border-border lg:pl-8">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Activity
          </p>
          <ShowcaseActivityFeed />
        </div>
      </div>
    </div>
  );
}
