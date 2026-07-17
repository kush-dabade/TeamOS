import { Card, CardContent } from "@/components/ui";
import { PageSection } from "@/components/layout";

import { TaskOverview } from "../TaskOverview";
import { TaskProperties } from "../TaskProperties";

import { TaskFutureSections } from "./TaskFutureSections";
import { TaskHeader } from "./TaskHeader";

import type { TaskAssignee, TaskListItem } from "../../types";

interface TaskWorkspaceProps {
  taskItem: TaskListItem;
  createdBy: TaskAssignee | null;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: () => void;
}

export function TaskWorkspace({ taskItem, createdBy, onEdit, onDelete }: TaskWorkspaceProps) {
  return (
    <>
      <TaskHeader taskItem={taskItem} onEdit={onEdit} onDelete={onDelete} />

      <div className="space-y-6 py-5">
        <PageSection title="Overview">
          <Card>
            <CardContent>
              <TaskOverview task={taskItem.task} />
            </CardContent>
          </Card>
        </PageSection>

        <PageSection title="Properties">
          <Card>
            <CardContent>
              <TaskProperties taskItem={taskItem} createdBy={createdBy} />
            </CardContent>
          </Card>
        </PageSection>

        <TaskFutureSections />
      </div>
    </>
  );
}
