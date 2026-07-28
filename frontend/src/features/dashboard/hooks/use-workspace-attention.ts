import { useMemo, useState } from "react";

import { useTasks } from "@/features/tasks";
import { useActiveWorkspace } from "@/features/workspaces";

import type { WorkspaceAttentionItem } from "../types";

interface UseWorkspaceAttentionResult {
  data: WorkspaceAttentionItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Data boundary for the dashboard "Workspace Attention" panel.
 *
 * Composes the Tasks feature's workspace-wide `useTasks` query - there is no
 * dedicated backend endpoint for this - into two categories: tasks overdue
 * (past due date, not yet done) and tasks pending review (status REVIEW). A
 * task can only land in one category, overdue taking priority since it is the
 * more urgent signal, so a task is never double-counted.
 */
export function useWorkspaceAttention(): UseWorkspaceAttentionResult {
  const { workspaceId } = useActiveWorkspace();
  const tasksQuery = useTasks(workspaceId ?? undefined);

  // Captured once per mount rather than read fresh on every render - the
  // purpose is "is this overdue as of when the panel loaded", not a live
  // ticking clock, and calling Date.now() directly during render is an
  // impure operation the project's lint rules reject.
  const [now] = useState(() => Date.now());

  const data = useMemo<WorkspaceAttentionItem[]>(() => {
    const overdue: WorkspaceAttentionItem[] = [];
    const pendingReview: WorkspaceAttentionItem[] = [];

    for (const { task, project } of tasksQuery.tasks) {
      const isOverdue =
        task.status !== "DONE" &&
        Boolean(task.dueDate) &&
        new Date(task.dueDate as string).getTime() < now;

      if (isOverdue) {
        overdue.push({
          id: `attention-${task.id}`,
          kind: "OVERDUE_TASK",
          title: task.title,
          context: project.name,
          occurredAt: task.dueDate as string,
          entityType: "TASK",
          entityId: task.id,
        });
        continue;
      }

      if (task.status === "REVIEW") {
        pendingReview.push({
          id: `attention-${task.id}`,
          kind: "PENDING_REVIEW",
          title: task.title,
          context: project.name,
          occurredAt: task.updatedAt,
          entityType: "TASK",
          entityId: task.id,
        });
      }
    }

    overdue.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    pendingReview.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    return [...overdue, ...pendingReview];
  }, [tasksQuery.tasks, now]);

  const isLoading = tasksQuery.isLoading;
  const isError = Boolean(tasksQuery.error);

  const refetch = () => {
    tasksQuery.refetch();
  };

  return { data, isLoading, isError, refetch };
}
