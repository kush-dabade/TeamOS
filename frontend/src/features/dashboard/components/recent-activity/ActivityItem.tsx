import type { DashboardActivity } from "../../types";

interface ActivityItemProps {
  activity: DashboardActivity;
  onClick?: () => void;
}

export function ActivityItem({ activity, onClick }: ActivityItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-sm font-medium leading-relaxed transition-colors group-hover:text-foreground">
        {activity.message}
      </p>

      <p className="text-muted-foreground mt-1 text-xs">{activity.timestamp}</p>
    </button>
  );
}
