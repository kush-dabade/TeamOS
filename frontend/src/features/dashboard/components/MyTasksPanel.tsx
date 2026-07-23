import type { ReactNode } from "react";
import { ArrowRight, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui";
import { EmptyState } from "@/components/ux";

import { DashboardPanel } from "./layout";
import { MyTasksTable } from "./my-tasks";

import { useMyTasks } from "../hooks/use-my-tasks";

const MAX_VISIBLE_TASKS = 7;

export function MyTasksPanel() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useMyTasks();

  const visibleTasks = data.slice(0, MAX_VISIBLE_TASKS);

  let content: ReactNode;

  if (isError) {
    content = (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your tasks</p>
        <p className="text-muted-foreground text-sm">
          Something went wrong while loading this section.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  } else if (!isLoading && visibleTasks.length === 0) {
    content = (
      <div className="flex min-h-40 items-center justify-center">
        <EmptyState
          icon={ListChecks}
          title="No assigned tasks"
          description="Tasks assigned to you will appear here."
          action={
            <Button type="button" size="sm" onClick={() => navigate("/tasks")}>
              Create task
            </Button>
          }
        />
      </div>
    );
  } else {
    content = (
      <MyTasksTable
        tasks={visibleTasks}
        isLoading={isLoading}
        onSelectTask={(taskId) => navigate(`/tasks/${taskId}`)}
      />
    );
  }

  return (
    <DashboardPanel
      title="My tasks"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs font-medium"
          onClick={() => navigate("/tasks")}
        >
          View all
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      {content}
    </DashboardPanel>
  );
}
