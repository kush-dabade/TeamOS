import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SearchX, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button, Skeleton } from "@/components/ui";
import { PageLayout } from "@/components/layout";
import { ErrorState, PageError } from "@/components/ux";
import { useProjects } from "@/features/projects";
// Direct module path (not the "@/features/sprints" barrel) deliberately -
// that barrel re-exports SprintsView, which imports taskKeys from
// "@/features/tasks" at runtime. This file lives inside the tasks feature
// itself, so importing the barrel here would create a real circular module
// dependency (tasks -> sprints -> tasks). use-sprints.ts's own dependency
// chain (sprints.api.ts, sprint-keys.ts) has no runtime import back into
// tasks - only a type-only one, which is erased at compile time - so this
// path is cycle-free.
import { useSprints } from "@/features/sprints/hooks/use-sprints";
import { useWorkspaceMembers } from "@/features/workspaces";

import { useDeleteTask } from "../hooks/use-delete-task";
import { useTask } from "../hooks/use-task";
import { useUpdateTask } from "../hooks/use-update-task";
import { TaskFormPanel } from "../components/form";
import { TaskHeader, TaskWorkspace } from "../components/workspace";
import type { TaskAssignee, TaskProject } from "../types";
import type { TaskFormData } from "../validation/task";

export function TaskWorkspacePage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const taskQuery = useTask(taskId);
  const taskDetail = taskQuery.data;

  const workspaceId = taskDetail?.taskItem.task.workspaceId;
  const projectsQuery = useProjects(workspaceId);
  const membersQuery = useWorkspaceMembers(workspaceId);
  const sprintsQuery = useSprints(taskDetail?.taskItem.task.projectId);

  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  if (taskQuery.isLoading) {
    return (
      <PageLayout>
        <div className="flex flex-col gap-3 py-4" aria-busy="true">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </PageLayout>
    );
  }

  if (taskQuery.error && !taskQuery.isNotFound) {
    return (
      <PageError>
        <ErrorState
          icon={TriangleAlert}
          title="Unable to load task"
          description="Something went wrong while loading this task. Check your connection and try again."
          action={
            <Button type="button" onClick={() => taskQuery.refetch()}>
              Retry
            </Button>
          }
        />
      </PageError>
    );
  }

  if (!taskDetail) {
    return (
      <PageError>
        <ErrorState
          icon={SearchX}
          title="Task not found"
          description="The task may have been removed or you may not have access to it."
          action={
            <Button asChild>
              <Link to="/tasks">Back to tasks</Link>
            </Button>
          }
        />
      </PageError>
    );
  }

  const { taskItem, createdBy } = taskDetail;

  const sprintName = taskItem.task.sprintId
    ? (sprintsQuery.data ?? []).find((sprint) => sprint.id === taskItem.task.sprintId)?.name ?? null
    : null;

  const projects: TaskProject[] = (projectsQuery.data ?? []).map(({ project }) => ({
    id: project.id,
    slug: project.slug,
    name: project.name,
  }));
  const assignees: TaskAssignee[] = (membersQuery.data ?? []).map((member) => ({
    id: member.userId,
    name: member.name,
  }));

  const handleEdit = (trigger: HTMLButtonElement) => {
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setFormPanelTrigger(null);
  };

  const handleTaskSubmit = async (data: TaskFormData) => {
    if (!taskId) {
      return;
    }

    await updateTask.mutateAsync({
      taskId,
      input: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate || null,
      },
    });

    toast.success("Task updated");
    setIsFormPanelOpen(false);
  };

  const handleDelete = async () => {
    if (!taskId) {
      return;
    }

    try {
      await deleteTask.mutateAsync({ taskId, projectId: taskItem.task.projectId });
      toast.success("Task deleted");
      navigate("/tasks");
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  return (
    <PageLayout>
      <TaskHeader
        taskItem={taskItem}
        sprintName={sprintName}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={deleteTask.isPending}
      />
      <TaskWorkspace taskItem={taskItem} createdBy={createdBy} sprintName={sprintName} />

      <TaskFormPanel
        mode="edit"
        taskItem={taskItem}
        projects={projects}
        assignees={assignees}
        open={isFormPanelOpen}
        onClose={() => setIsFormPanelOpen(false)}
        onCloseAutoFocus={handleCloseAutoFocus}
        onSubmit={handleTaskSubmit}
      />
    </PageLayout>
  );
}
