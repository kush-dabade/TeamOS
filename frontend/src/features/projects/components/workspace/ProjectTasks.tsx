import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  TaskFormPanel,
  TaskPreviewPanel,
  TasksTable,
  useCreateTask,
  useDeleteTask,
  useProjectTasks,
  useUpdateTask,
  type TaskAssignee,
  type TaskFormData,
  type TaskListItem,
  type TaskProject,
} from "@/features/tasks";
import { useWorkspaceMembers } from "@/features/workspaces";

interface ProjectTasksProps {
  project: TaskProject;
  workspaceId: string;
}

// Mirrors TasksPage's selection/preview/form state and data-assembly pattern
// (see use-tasks.ts), scoped down to a single project. The project is passed
// to TaskFormPanel as the only selectable option (create) and TaskForm
// already disables the project field in edit mode - both keep a task locked
// to this project without any change to the shared form component.
export function ProjectTasks({ project, workspaceId }: ProjectTasksProps) {
  const navigate = useNavigate();

  const tasksQuery = useProjectTasks(project.id);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTaskTrigger, setSelectedTaskTrigger] = useState<HTMLButtonElement | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const assigneesByUserId = useMemo(
    () =>
      new Map(
        (membersQuery.data ?? []).map((member) => [
          member.userId,
          { id: member.userId, name: member.name },
        ]),
      ),
    [membersQuery.data],
  );

  const assignees: TaskAssignee[] = useMemo(
    () => (membersQuery.data ?? []).map((member) => ({ id: member.userId, name: member.name })),
    [membersQuery.data],
  );

  const taskItems: TaskListItem[] = useMemo(
    () =>
      (tasksQuery.data ?? []).map((task) => ({
        task,
        assignee: task.assigneeId ? (assigneesByUserId.get(task.assigneeId) ?? null) : null,
        project,
      })),
    [tasksQuery.data, assigneesByUserId, project],
  );

  const isLoading = tasksQuery.isLoading || membersQuery.isLoading;
  const errorMessage = tasksQuery.error?.message ?? membersQuery.error?.message ?? null;

  const handleRetry = () => {
    tasksQuery.refetch();
    membersQuery.refetch();
  };

  const handleTaskSelect = (taskId: string, trigger: HTMLButtonElement | null) => {
    setSelectedTaskId(taskId);
    setSelectedTaskTrigger(trigger);
    setIsPreviewOpen(true);
  };

  const selectedTask = taskItems.find((taskItem) => taskItem.task.id === selectedTaskId) ?? null;
  const selectedTaskCreator: TaskAssignee | null = selectedTask
    ? (assigneesByUserId.get(selectedTask.task.createdById) ?? null)
    : null;

  const handleOpenTask = (taskId: string) => navigate(`/tasks/${taskId}`);
  const handlePreviewClose = () => setIsPreviewOpen(false);
  const handlePreviewCloseAutoFocus = () => {
    selectedTaskTrigger?.focus();
    setSelectedTaskId(null);
    setSelectedTaskTrigger(null);
  };

  const handleCreateTask = (trigger: HTMLButtonElement) => {
    setEditingTaskId(null);
    setFormMode("create");
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleEditTask = () => {
    setEditingTaskId(selectedTaskId);
    setFormMode("edit");
    setFormPanelTrigger(selectedTaskTrigger);
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

  const handleTaskFormSubmit = async (data: TaskFormData) => {
    if (formMode === "create") {
      await createTask.mutateAsync({
        projectId: project.id,
        input: {
          title: data.title,
          description: data.description || undefined,
          priority: data.priority,
          assigneeId: data.assigneeId || undefined,
          dueDate: data.dueDate || undefined,
        },
      });
      toast.success("Task created");
    }

    if (formMode === "edit" && editingTaskId) {
      await updateTask.mutateAsync({
        taskId: editingTaskId,
        input: {
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          assigneeId: data.assigneeId || null,
          dueDate: data.dueDate || null,
        },
      });
      toast.success("Task updated");
    }

    handleFormPanelClose();
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId) {
      return;
    }

    try {
      await deleteTask.mutateAsync({ taskId: selectedTaskId, projectId: project.id });
      toast.success("Task deleted");
      handlePreviewClose();
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  return (
    <>
      <TasksTable
        tasks={taskItems}
        selectedTaskId={selectedTaskId}
        isLoading={isLoading}
        error={errorMessage}
        hasActiveFilters={false}
        showProjectColumn={false}
        onTaskSelect={handleTaskSelect}
        onCreateTask={handleCreateTask}
        onRetry={handleRetry}
        onClearFilters={() => {}}
      />

      <TaskPreviewPanel
        taskItem={selectedTask}
        createdBy={selectedTaskCreator}
        open={isPreviewOpen}
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onOpenTask={handleOpenTask}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        isDeleting={deleteTask.isPending}
      />

      <TaskFormPanel
        mode={formMode}
        taskItem={taskItems.find((taskItem) => taskItem.task.id === editingTaskId) ?? null}
        projects={[project]}
        assignees={assignees}
        open={isFormPanelOpen}
        onClose={handleFormPanelClose}
        onCloseAutoFocus={handleFormPanelCloseAutoFocus}
        onSubmit={handleTaskFormSubmit}
      />
    </>
  );
}
