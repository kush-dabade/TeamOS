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
      <main className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <section className="flex lg:col-span-7">
          <TodaysFocusPanel />
        </section>

        <aside className="flex lg:col-span-5">
          <WorkspaceSnapshotPanel />
        </aside>

        <aside className="flex lg:col-span-5">
          <SinceLastVisitPanel />
        </aside>

        <section className="flex lg:col-span-7">
          <ActiveProjectsPanel />
        </section>
      </main>
    </PageLayout>
  );
}
