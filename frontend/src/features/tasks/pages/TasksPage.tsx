import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageLayout } from "@/components/layout";
import { useAuth } from "@/features/auth";
import { useProjects } from "@/features/projects";
// Direct module path, not the "@/features/sprints" barrel - see the same
// note in TaskWorkspacePage.tsx. This file is part of the tasks feature
// barrel, and the sprints barrel re-exports SprintsView, which imports
// taskKeys from "@/features/tasks" at runtime - going through it here would
// create a circular module dependency.
import { useSprints } from "@/features/sprints/hooks/use-sprints";
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
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  // The sidebar My Tasks section's "View all" link is the sole producer of
  // ?assignee=me, and TasksToolbar's own assignee Select is the source of
  // truth for this filter after that (mirrors how none of the other filters
  // below sync back to the URL either).
  const [searchParams] = useSearchParams();
  const assigneeParam = searchParams.get("assignee");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState(() =>
    assigneeParam === "me" && user ? user.id : "ALL",
  );

  // The initializer above only runs on mount, so it alone misses navigating
  // from /tasks to /tasks?assignee=me: same route element, only the query
  // string changes, so TasksPage never remounts. assigneeFilter can also be
  // changed independently by TasksToolbar's own Select, so it isn't purely
  // derived state - syncing it from the URL needs to know whether
  // (assigneeParam, user) actually changed since the last sync, not run on
  // every render. Tracked and self-healed here during render (mirrors
  // WorkspaceProvider's activeWorkspaceId/storedWorkspaceId reconciliation)
  // rather than in a useEffect, which the project's lint config flags as a
  // cascading-render anti-pattern for exactly this kind of derived sync.
  const [syncedAssigneeParam, setSyncedAssigneeParam] = useState(assigneeParam);
  const [syncedUserId, setSyncedUserId] = useState(user?.id);

  if (assigneeParam !== syncedAssigneeParam || user?.id !== syncedUserId) {
    setSyncedAssigneeParam(assigneeParam);
    setSyncedUserId(user?.id);

    if (assigneeParam === "me") {
      // If user hasn't resolved yet, leave assigneeFilter as-is - this
      // block re-runs once `user` (and therefore user?.id) changes, so it
      // still gets applied once auth finishes initializing.
      if (user) {
        setAssigneeFilter(user.id);
      }
    } else {
      setAssigneeFilter("ALL");
    }
  }
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
    () =>
      (membersQuery.data ?? []).map((member) => ({
        id: member.userId,
        name: member.name,
        image: member.image,
      })),
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

  // Scoped to the selected task's own project - only one task is ever
  // previewed at a time, so there's no need to fan out a sprint query per
  // project in the workspace the way useTasks fans out task queries.
  const selectedTaskSprintsQuery = useSprints(selectedTask?.task.projectId);
  const selectedTaskSprintName = selectedTask?.task.sprintId
    ? ((selectedTaskSprintsQuery.data ?? []).find(
        (sprint) => sprint.id === selectedTask.task.sprintId,
      )?.name ?? null)
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
          status: data.status,
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
      <PageHeader title="Tasks" />

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
            isLoading={isLoadingTasks}
            error={tasksError?.message ?? null}
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
        sprintName={selectedTaskSprintName}
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
