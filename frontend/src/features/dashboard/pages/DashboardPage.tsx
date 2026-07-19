import { PageLayout } from "@/components/layout";

import {
  ActiveProjectsPanel,
  SinceLastVisitPanel,
  TodaysFocusPanel,
  WorkspaceSnapshotPanel,
} from "../components";

export function DashboardPage() {
  return (
    <PageLayout>
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <aside className="grid">
            <WorkspaceSnapshotPanel />
          </aside>

          <aside className="grid">
            <ActiveProjectsPanel />
          </aside>
        </div>

        <section className="grid min-h-80">
          <TodaysFocusPanel />
        </section>

        <section className="grid">
          <SinceLastVisitPanel />
        </section>
      </div>
    </PageLayout>
  );
}
