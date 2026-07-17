import { PageHeader, PageLayout } from "@/components/layout";

import { TaskWorkspace } from "../components/workspace";

export function TaskWorkspacePage() {
  return (
    <PageLayout>
      <PageHeader title="Task" />
      <TaskWorkspace />
    </PageLayout>
  );
}
