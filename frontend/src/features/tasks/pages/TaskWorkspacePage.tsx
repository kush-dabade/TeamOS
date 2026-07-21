import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { PageLayout } from "@/components/layout";
import { useProjects } from "@/features/projects";
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

  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  if (taskQuery.isLoading) {
    return (
      <PageLayout>
        <p className="mt-3 text-sm text-muted-foreground">Loading task...</p>
      </PageLayout>
    );
  }

  if (taskQuery.error) {
    return (
      <PageLayout>
        <div className="mt-3 flex min-h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-medium">Unable to load task</p>
          <Button type="button" variant="outline" onClick={() => taskQuery.refetch()}>
            Retry
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (!taskDetail) {
    return (
      <PageLayout>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Task not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The task may have been removed or you may not have access to it.
        </p>
      </PageLayout>
    );
  }

  const { taskItem, createdBy } = taskDetail;

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

    await deleteTask.mutateAsync({ taskId, projectId: taskItem.task.projectId });
    toast.success("Task deleted");
    navigate("/tasks");
  };

  return (
    <PageLayout>
      <TaskHeader taskItem={taskItem} onEdit={handleEdit} onDelete={handleDelete} />
      <TaskWorkspace taskItem={taskItem} createdBy={createdBy} />

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
