import { PageHeader, PageLayout } from "@/components/layout";

import { TasksTable } from "../components/table";
import { TasksToolbar } from "../components/toolbar";

export function TasksPage() {
  return (
    <PageLayout>
      <PageHeader title="Tasks" />

      <div className="mt-3">
        <TasksToolbar />
        <div className="mt-4">
          <TasksTable />
        </div>
      </div>
    </PageLayout>
  );
}
