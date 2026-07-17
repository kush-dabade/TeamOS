import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageLayout } from "@/components/layout";
import { mockProjects } from "@/features/projects/data/projects.mock";

import { TaskFormPanel } from "../components/form";
import { TaskWorkspace } from "../components/workspace";
import { mockTasks, mockWorkspaceUsers } from "../data/tasks.mock";
import type { TaskListItem } from "../types";
import type { TaskFormData } from "../validation/task";

export function TaskWorkspacePage() {
  const { taskId } = useParams();
  const resolvedTask = mockTasks.find((taskItem) => taskItem.task.id === taskId) ?? null;
  const [editedTask, setEditedTask] = useState<TaskListItem | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const taskItem = editedTask?.task.id === taskId ? editedTask : resolvedTask;

  if (!taskItem) {
    return (
      <PageLayout>
        <p className="mt-3 text-sm text-muted-foreground">Task not found.</p>
      </PageLayout>
    );
  }

  const createdBy = mockWorkspaceUsers.find((user) => user.id === taskItem.task.createdById) ?? null;

  const handleEdit = (trigger: HTMLButtonElement) => {
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setFormPanelTrigger(null);
  };

  const handleTaskSubmit = (data: TaskFormData) => {
    const selectedProject = mockProjects.find((item) => item.project.id === data.projectId)?.project;

    if (!selectedProject) {
      return;
    }

    const assignee = mockWorkspaceUsers.find((user) => user.id === data.assigneeId) ?? null;

    setEditedTask({
      ...taskItem,
      task: {
        ...taskItem.task,
        title: data.title,
        projectId: data.projectId,
        description: data.description || null,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      assignee,
      project: selectedProject,
    });
    toast.success("Task updated");
    setIsFormPanelOpen(false);
  };

  return (
    <PageLayout>
      <TaskWorkspace
        taskItem={taskItem}
        createdBy={createdBy}
        onEdit={handleEdit}
        onDelete={() => undefined}
      />

      <TaskFormPanel
        mode="edit"
        taskItem={taskItem}
        projects={mockProjects.map(({ project }) => project)}
        assignees={mockWorkspaceUsers}
        open={isFormPanelOpen}
        onClose={() => setIsFormPanelOpen(false)}
        onCloseAutoFocus={handleCloseAutoFocus}
        onSubmit={handleTaskSubmit}
      />
    </PageLayout>
  );
}
