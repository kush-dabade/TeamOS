import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";

import { DashboardPanel } from "./layout";
import { HealthItem } from "./workspace-snapshot";

import { mockWorkspaceHealth } from "../data/dashboard.mock";

export function WorkspaceSnapshotPanel() {
  return (
    <DashboardPanel
      title="Workspace Health"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="
            h-6
            px-1.5
            text-xs
            font-medium
          "
        >
          View details
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      <div className="divide-y divide-border">
        {mockWorkspaceHealth.map((item) => (
          <HealthItem key={item.id} item={item} />
        ))}
      </div>
    </DashboardPanel>
  );
}
