import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, PageLayout } from "@/components/layout";
import { mockProjects } from "@/features/projects/data/projects.mock";

import { TaskPreviewPanel } from "../components/preview";
import { TaskFormPanel } from "../components/form";
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
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const handleCreateTask = (trigger: HTMLButtonElement) => {
    setFormMode("create");
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };
  const handleTaskSelect = (taskId: string) => setSelectedTaskId(taskId);
  const selectedTask = mockTasks.find((taskItem) => taskItem.task.id === selectedTaskId) ?? null;
  const selectedTaskCreator = selectedTask
    ? mockWorkspaceUsers.find((user) => user.id === selectedTask.task.createdById) ?? null
    : null;
  const handleOpenTask = () => undefined;
  const handleFormPanelClose = () => setIsFormPanelOpen(false);
  const handleFormPanelCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setFormMode(null);
    setFormPanelTrigger(null);
  };
  const handleTaskFormSubmit = async () => {
    toast.success(formMode === "create" ? "Task created" : "Task updated");
    handleFormPanelClose();
  };

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
        <div className="mt-4">
          <TaskPreviewPanel
            taskItem={selectedTask}
            createdBy={selectedTaskCreator}
            isLoading={false}
            onOpenTask={handleOpenTask}
          />
        </div>
      </div>

      <TaskFormPanel
        mode={formMode}
        taskItem={null}
        projects={mockProjects.map(({ project }) => project)}
        assignees={mockWorkspaceUsers}
        open={isFormPanelOpen}
        onClose={handleFormPanelClose}
        onCloseAutoFocus={handleFormPanelCloseAutoFocus}
        onSubmit={handleTaskFormSubmit}
      />
    </PageLayout>
  );
}
