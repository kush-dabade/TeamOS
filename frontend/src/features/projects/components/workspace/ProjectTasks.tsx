import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import {
  TaskFormPanel,
  TaskPreviewPanel,
  TasksTable,
  canManageTasks,
  useCreateTask,
  useDeleteTask,
  useProjectTasks,
  useUpdateTask,
  type TaskAssignee,
  type TaskFormData,
  type TaskListItem,
  type TaskProject,
} from "@/features/tasks";
import { useActiveWorkspace, useWorkspaceMembers } from "@/features/workspaces";

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
  const { workspace } = useActiveWorkspace();

  const [page, setPage] = useState(1);
  const tasksQuery = useProjectTasks(project.id, page);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTaskTrigger, setSelectedTaskTrigger] = useState<HTMLButtonElement | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);
  // Stable focus target for after a task is deleted - the row that had
  // focus is about to unmount once the list refetches, so restoring focus
  // there would be pointless at best.
  const createActionRef = useRef<HTMLButtonElement>(null);

  const canManage = canManageTasks(workspace?.role);

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
      (tasksQuery.data?.tasks ?? []).map((task) => ({
        task,
        assignee: task.assigneeId ? (assigneesByUserId.get(task.assigneeId) ?? null) : null,
        project,
      })),
    [tasksQuery.data, assigneesByUserId, project],
  );

  const pagination = tasksQuery.data?.pagination;

  // A mutation (e.g. deleting the last task on this page) can shrink
  // `pagination.pages` below the currently-viewed page, or to 0 for an
  // empty project. Left uncorrected, the table would keep requesting a page
  // that no longer exists and render as permanently, misleadingly empty.
  // Adjusts `page` directly during render (React's documented alternative to
  // an Effect for this exact "correct state in response to new data" case:
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in a
  // useEffect, which the repo's lint config flags as cascading-render-prone.
  // `lastPagination` only tracks which pagination result has already been
  // reconciled, so this block runs at most once per distinct fetch result.
  const [lastPagination, setLastPagination] = useState(pagination);

  if (pagination && pagination !== lastPagination) {
    setLastPagination(pagination);

    if (pagination.pages === 0) {
      if (page !== 1) {
        setPage(1);
      }
    } else if (page > pagination.pages) {
      setPage(pagination.pages);
    }
  }

  const isLoading = tasksQuery.isLoading || membersQuery.isLoading;
  const errorMessage = tasksQuery.error?.message ?? membersQuery.error?.message ?? null;

  const handleRetry = () => {
    tasksQuery.refetch();
    membersQuery.refetch();
  };

  const handlePreviousPage = () => setPage((current) => Math.max(1, current - 1));
  const handleNextPage = () => setPage((current) => current + 1);

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
      // Redirect the existing close-auto-focus target to the persistent
      // create action (a control guaranteed to still exist) instead of the
      // just-deleted row's button, which is about to unmount once the task
      // list refetches - reuses handlePreviewCloseAutoFocus's existing
      // selectedTaskTrigger?.focus() rather than adding a second focus path.
      setSelectedTaskTrigger(createActionRef.current);
      handlePreviewClose();
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Tasks</h2>
        {canManage ? (
          <Button
            type="button"
            ref={createActionRef}
            onClick={(event) => handleCreateTask(event.currentTarget)}
          >
            Create task
          </Button>
        ) : null}
      </div>

      <div className="mt-3">
        <TasksTable
          tasks={taskItems}
          selectedTaskId={selectedTaskId}
          isLoading={isLoading}
          error={errorMessage}
          hasActiveFilters={false}
          showProjectColumn={false}
          onTaskSelect={handleTaskSelect}
          onCreateTask={canManage ? handleCreateTask : undefined}
          onRetry={handleRetry}
        />
      </div>

      {pagination && pagination.pages > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <TaskPreviewPanel
        taskItem={selectedTask}
        createdBy={selectedTaskCreator}
        open={isPreviewOpen}
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onOpenTask={handleOpenTask}
        onEdit={canManage ? handleEditTask : undefined}
        onDelete={canManage ? handleDeleteTask : undefined}
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
