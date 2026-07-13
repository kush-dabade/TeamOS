import { DashboardPanel } from "./layout";
import { SnapshotStat } from "./workspace-snapshot";

import { mockWorkspaceSnapshot } from "../data/dashboard.mock";

export function WorkspaceSnapshotPanel() {
  return (
    <DashboardPanel title="Workspace Snapshot" description="Current workspace overview.">
      <div className="divide-border divide-y">
        <SnapshotStat label="Projects" value={mockWorkspaceSnapshot.projectCount} />

        <SnapshotStat label="Open Tasks" value={mockWorkspaceSnapshot.taskCount} />

        <SnapshotStat label="Members" value={mockWorkspaceSnapshot.memberCount} />

        <SnapshotStat
          label="Current Sprint"
          value={<span className="text-emerald-600 font-medium">Active</span>}
        />
      </div>
    </DashboardPanel>
  );
}
