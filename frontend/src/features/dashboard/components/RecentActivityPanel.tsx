import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui";
import { EmptyState } from "@/components/ux";

import { DashboardPanel } from "./layout";
import { ActivityRow, RecentActivitySkeleton } from "./recent-activity";

import { useRecentActivity } from "../hooks/use-recent-activity";
import type { RecentActivityItem } from "../types";

const MAX_VISIBLE_ITEMS = 6;

// Resolves an activity to an in-app destination, or null when it isn't
// navigable. Only tasks are routable today: an activity's `entityId` is the
// task id, which the task route accepts directly. Projects route by slug, which
// the Activity contract doesn't yet expose, so project (and every other)
// activity stays awareness-only until the backend provides routing info.
function resolveActivityHref(item: RecentActivityItem): string | null {
  return item.entityType === "TASK" ? `/tasks/${item.entityId}` : null;
}

export function RecentActivityPanel() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useRecentActivity();

  const visibleItems = data.slice(0, MAX_VISIBLE_ITEMS);

  const handleSelect = (item: RecentActivityItem) => {
    const href = resolveActivityHref(item);
    if (href) {
      navigate(href);
    }
  };

  let content: ReactNode;

  if (isError) {
    content = (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load recent activity</p>
        <p className="text-muted-foreground text-sm">
          Something went wrong while loading this section.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  } else if (isLoading) {
    content = <RecentActivitySkeleton />;
  } else if (visibleItems.length === 0) {
    content = (
      <div className="flex min-h-40 items-center justify-center">
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Updates across your workspace will appear here."
        />
      </div>
    );
  } else {
    content = (
      <div className="divide-border divide-y">
        {visibleItems.map((item) => (
          <ActivityRow
            key={item.id}
            item={item}
            interactive={resolveActivityHref(item) !== null}
            onSelect={handleSelect}
          />
        ))}
      </div>
    );
  }

  return <DashboardPanel title="Recent activity">{content}</DashboardPanel>;
}
