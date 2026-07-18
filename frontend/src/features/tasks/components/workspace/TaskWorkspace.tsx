import { Card, CardContent } from "@/components/ui";

import { TaskOverview } from "../TaskOverview";
import { TaskProperties } from "../TaskProperties";

import { TaskFutureSections } from "./TaskFutureSections";

import type { TaskAssignee, TaskListItem } from "../../types";

interface TaskWorkspaceProps {
  taskItem: TaskListItem;
  createdBy: TaskAssignee | null;
}

export function TaskWorkspace({ taskItem, createdBy }: TaskWorkspaceProps) {
  return (
    <div className="space-y-5 py-5">
        <section aria-labelledby="task-overview-heading">
          <h2 id="task-overview-heading" className="text-sm font-medium">Overview</h2>
          <Card size="sm" className="mt-3">
            <CardContent>
              <TaskOverview task={taskItem.task} />
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="task-properties-heading">
          <h2 id="task-properties-heading" className="text-sm font-medium">Properties</h2>
          <Card size="sm" className="mt-3">
            <CardContent>
              <TaskProperties taskItem={taskItem} createdBy={createdBy} />
            </CardContent>
          </Card>
        </section>

        <TaskFutureSections />
    </div>
  );
}
