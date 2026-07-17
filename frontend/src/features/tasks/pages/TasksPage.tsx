import { useState } from "react";

import { PageHeader, PageLayout } from "@/components/layout";
import { mockProjects } from "@/features/projects/data/projects.mock";

import { TasksTable } from "../components/table";
import { TasksToolbar } from "../components/toolbar";
import { mockTasks, mockWorkspaceUsers } from "../data/tasks.mock";
import type { TaskPriorityFilter, TaskStatusFilter } from "../types";

export function TasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleCreateTask = () => undefined;
  const handleTaskSelect = (taskId: string) => setSelectedTaskId(taskId);

  return (
    <PageLayout>
      <PageHeader title="Tasks" />

      <div className="mt-3">
        <TasksToolbar
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          projectFilter={projectFilter}
          assigneeFilter={assigneeFilter}
          projects={mockProjects.map(({ project }) => project)}
          assignees={mockWorkspaceUsers}
          onSearchQueryChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onPriorityFilterChange={setPriorityFilter}
          onProjectFilterChange={setProjectFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          onCreateTask={handleCreateTask}
        />
        <div className="mt-4">
          <TasksTable
            tasks={mockTasks}
            selectedTaskId={selectedTaskId}
            isLoading={false}
            onTaskSelect={handleTaskSelect}
            onCreateTask={handleCreateTask}
          />
        </div>
      </div>
    </PageLayout>
  );
}
