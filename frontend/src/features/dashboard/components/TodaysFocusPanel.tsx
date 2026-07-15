import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";

import { DashboardPanel } from "./layout";
import { FocusItem } from "./focus-item";

import { mockTasks } from "../data/dashboard.mock";

export function TodaysFocusPanel() {
  return (
    <DashboardPanel
      title="Today's Focus"
      action={
        <Button
          variant="ghost"
          size="sm"
          className="
            h-6
            px-1.5
            text-xs
            font-medium
          "
        >
          View all
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      <div className="divide-y divide-border">
        {mockTasks.map((task) => (
          <FocusItem key={task.id} task={task} />
        ))}
      </div>
    </DashboardPanel>
  );
}
