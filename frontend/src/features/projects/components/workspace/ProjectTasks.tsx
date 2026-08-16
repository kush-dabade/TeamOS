import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  TaskPreviewPanel,
  TasksTable,
  useProjectTasks,
  type TaskAssignee,
  type TaskListItem,
  type TaskProject,
} from "@/features/tasks";
import { useWorkspaceMembers } from "@/features/workspaces";

interface ProjectTasksProps {
  project: TaskProject;
  workspaceId: string;
}

// Deliberately mirrors TasksPage's selection/preview state and data-assembly
// pattern (see use-tasks.ts), scoped down to a single project: task-select,
// preview-open, and "open task" navigation are read-path only here. Creation
// and editing are wired in a later commit - onCreateTask/onEdit are present
// only because TasksTable's empty state and TaskPreviewPanel's footer render
// those actions unconditionally and require a handler to render correctly.
export function ProjectTasks({ project, workspaceId }: ProjectTasksProps) {
  const navigate = useNavigate();

  const tasksQuery = useProjectTasks(project.id);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTaskTrigger, setSelectedTaskTrigger] = useState<HTMLButtonElement | null>(null);

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
        onCreateTask={() => {}}
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
        onEdit={() => {}}
      />
    </>
  );
}
