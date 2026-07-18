import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageLayout } from "@/components/layout";
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTaskTrigger, setSelectedTaskTrigger] = useState<HTMLButtonElement | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const navigate = useNavigate();

  const handleCreateTask = (trigger: HTMLButtonElement) => {
    setEditingTaskId(null);
    setFormMode("create");
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };
  const handleTaskSelect = (taskId: string, trigger: HTMLButtonElement | null) => {
    setSelectedTaskId(taskId);
    setSelectedTaskTrigger(trigger);
    setIsPreviewOpen(true);
  };
  const selectedTask = mockTasks.find((taskItem) => taskItem.task.id === selectedTaskId) ?? null;
  const selectedTaskCreator = selectedTask
    ? (mockWorkspaceUsers.find((user) => user.id === selectedTask.task.createdById) ?? null)
    : null;
  const handleOpenTask = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };
  const handlePreviewClose = () => setIsPreviewOpen(false);
  const handlePreviewCloseAutoFocus = () => {
    selectedTaskTrigger?.focus();
    setSelectedTaskId(null);
    setSelectedTaskTrigger(null);
  };
  const handleEditTask = (trigger: HTMLButtonElement) => {
    setEditingTaskId(selectedTaskId);
    setFormMode("edit");
    setFormPanelTrigger(trigger);
    setIsPreviewOpen(false);
    setIsFormPanelOpen(true);
  };
  const handleFormPanelClose = () => setIsFormPanelOpen(false);
  const handleFormPanelCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setEditingTaskId(null);
    setFormMode(null);
    setFormPanelTrigger(null);
  };
  const handleTaskFormSubmit = async () => {
    toast.success(formMode === "create" ? "Task created" : "Task updated");
    handleFormPanelClose();
  };

  return (
    <PageLayout>
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

      <TaskPreviewPanel
        taskItem={selectedTask}
        createdBy={selectedTaskCreator}
        open={isPreviewOpen}
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onOpenTask={handleOpenTask}
        onEdit={handleEditTask}
        onDelete={() => undefined}
      />

      <TaskFormPanel
        mode={formMode}
        taskItem={mockTasks.find((taskItem) => taskItem.task.id === editingTaskId) ?? null}
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
