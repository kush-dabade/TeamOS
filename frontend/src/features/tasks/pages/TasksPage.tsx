import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageLayout } from "@/components/layout";
import { useProjects } from "@/features/projects";
import { useActiveWorkspace, useWorkspaceMembers } from "@/features/workspaces";

import { useCreateTask } from "../hooks/use-create-task";
import { useTasks } from "../hooks/use-tasks";
import { useUpdateTask } from "../hooks/use-update-task";
import { TaskPreviewPanel } from "../components/preview";
import { TaskFormPanel } from "../components/form";
import { TasksTable } from "../components/table";
import { TasksToolbar } from "../components/toolbar";
import type { TaskAssignee, TaskPriorityFilter, TaskProject, TaskStatusFilter } from "../types";
import type { TaskFormData } from "../validation/task";

export function TasksPage() {
  const navigate = useNavigate();
  const {
    activeWorkspace: workspace,
    isLoading: isWorkspaceLoading,
    isError: isWorkspaceError,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useActiveWorkspace();

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

  const {
    tasks: taskItems,
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks(workspace?.id);
  const projectsQuery = useProjects(workspace?.id);
  const membersQuery = useWorkspaceMembers(workspace?.id);

  const projects: TaskProject[] = useMemo(
    () =>
      (projectsQuery.data ?? []).map(({ project }) => ({
        id: project.id,
        slug: project.slug,
        name: project.name,
      })),
    [projectsQuery.data],
  );
  const assignees: TaskAssignee[] = useMemo(
    () => (membersQuery.data ?? []).map((member) => ({ id: member.userId, name: member.name })),
    [membersQuery.data],
  );

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const tasks = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return taskItems.filter(({ task, assignee, project }) => {
      if (normalizedSearchQuery && !task.title.toLowerCase().includes(normalizedSearchQuery)) {
        return false;
      }

      if (statusFilter !== "ALL" && task.status !== statusFilter) {
        return false;
      }

      if (priorityFilter !== "ALL" && task.priority !== priorityFilter) {
        return false;
      }

      if (projectFilter !== "ALL" && project.id !== projectFilter) {
        return false;
      }

      if (assigneeFilter === "UNASSIGNED" && assignee !== null) {
        return false;
      }

      if (
        assigneeFilter !== "ALL" &&
        assigneeFilter !== "UNASSIGNED" &&
        assignee?.id !== assigneeFilter
      ) {
        return false;
      }

      return true;
    });
  }, [taskItems, searchQuery, statusFilter, priorityFilter, projectFilter, assigneeFilter]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    projectFilter !== "ALL" ||
    assigneeFilter !== "ALL";

  const handleRetry = () => {
    if (isWorkspaceError) {
      refetchWorkspace();
      return;
    }

    refetchTasks();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setProjectFilter("ALL");
    setAssigneeFilter("ALL");
  };

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

  const selectedTask = taskItems.find((taskItem) => taskItem.task.id === selectedTaskId) ?? null;
  const selectedTaskCreator = selectedTask
    ? (assignees.find((assignee) => assignee.id === selectedTask.task.createdById) ?? null)
    : null;

  const handleOpenTask = (taskId: string) => navigate(`/tasks/${taskId}`);
  const handlePreviewClose = () => setIsPreviewOpen(false);
  const handlePreviewCloseAutoFocus = () => {
    selectedTaskTrigger?.focus();
    setSelectedTaskId(null);
    setSelectedTaskTrigger(null);
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
      if (!data.projectId) {
        return;
      }

      await createTask.mutateAsync({
        projectId: data.projectId,
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

  return (
    <PageLayout>
      <div className="mt-3">
        <TasksToolbar
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          projectFilter={projectFilter}
          assigneeFilter={assigneeFilter}
          projects={projects}
          assignees={assignees}
          onSearchQueryChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onPriorityFilterChange={setPriorityFilter}
          onProjectFilterChange={setProjectFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          onCreateTask={handleCreateTask}
        />
        <div className="mt-4">
          <TasksTable
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            isLoading={isWorkspaceLoading || isLoadingTasks}
            error={
              isWorkspaceError ? (workspaceError?.message ?? null) : (tasksError?.message ?? null)
            }
            hasActiveFilters={hasActiveFilters}
            onTaskSelect={handleTaskSelect}
            onCreateTask={handleCreateTask}
            onRetry={handleRetry}
            onClearFilters={handleClearFilters}
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
      />

      <TaskFormPanel
        mode={formMode}
        taskItem={taskItems.find((taskItem) => taskItem.task.id === editingTaskId) ?? null}
        projects={projects}
        assignees={assignees}
        open={isFormPanelOpen}
        onClose={handleFormPanelClose}
        onCloseAutoFocus={handleFormPanelCloseAutoFocus}
        onSubmit={handleTaskFormSubmit}
      />
    </PageLayout>
  );
}
