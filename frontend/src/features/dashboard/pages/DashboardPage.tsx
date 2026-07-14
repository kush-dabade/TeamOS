import { PageHeader, PageLayout } from "@/components/layout";

import {
  ActiveProjectsPanel,
  RecentActivityPanel,
  TodaysFocusPanel,
  WorkspaceSnapshotPanel,
} from "../components";

export function DashboardPage() {
  return (
    <PageLayout>
      <PageHeader
        title="Good morning, Kush 👋"
        description="Here's what's happening across your workspace today."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TodaysFocusPanel />
        </div>

        <div className="lg:col-span-4">
          <WorkspaceSnapshotPanel />
        </div>

        <div className="lg:col-span-5">
          <RecentActivityPanel />
        </div>

        <div className="lg:col-span-7">
          <ActiveProjectsPanel />
        </div>
      </div>
    </PageLayout>
  );
}
