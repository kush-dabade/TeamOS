import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
import { useProject } from "@/features/projects";
import { useWorkspaceMembers } from "@/features/workspaces";

import { fetchTask } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { Task, TaskAssignee, TaskListItem } from "../types";

export interface TaskDetail {
  taskItem: TaskListItem;
  createdBy: TaskAssignee | null;
}

export function useTask(taskId: string | undefined) {
  const taskQuery = useQuery<Task, AppError>({
    queryKey: taskKeys.detail(taskId ?? ""),
    queryFn: () => fetchTask(taskId as string),
    enabled: Boolean(taskId),
  });

  const task = taskQuery.data;
  const projectQuery = useProject(task?.projectId);
  const membersQuery = useWorkspaceMembers(task?.workspaceId);

  const isLoading =
    taskQuery.isLoading || (Boolean(task) && (projectQuery.isLoading || membersQuery.isLoading));

  const error = taskQuery.error ?? projectQuery.error ?? membersQuery.error ?? null;

  const data = useMemo<TaskDetail | undefined>(() => {
    if (!task || !projectQuery.data || !membersQuery.data) {
      return undefined;
    }

    const membersByUserId = new Map(
      membersQuery.data.map((member) => [member.userId, { id: member.userId, name: member.name }]),
    );

    const projectDetails = projectQuery.data.project.project;

    return {
      taskItem: {
        task,
        assignee: task.assigneeId ? (membersByUserId.get(task.assigneeId) ?? null) : null,
        project: {
          id: projectDetails.id,
          slug: projectDetails.slug,
          name: projectDetails.name,
        },
      },
      createdBy: membersByUserId.get(task.createdById) ?? null,
    };
  }, [task, projectQuery.data, membersQuery.data]);

  return { data, isLoading, error, refetch: taskQuery.refetch };
}
