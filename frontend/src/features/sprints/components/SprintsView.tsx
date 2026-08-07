import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { useProjectTasks } from "@/features/tasks";

import { useAssignTaskToSprint } from "../hooks/use-assign-task-to-sprint";
import { useCompleteSprint } from "../hooks/use-complete-sprint";
import { useCreateSprint } from "../hooks/use-create-sprint";
import { useRemoveTaskFromSprint } from "../hooks/use-remove-task-from-sprint";
import { useSprints } from "../hooks/use-sprints";
import { useSprintTasks } from "../hooks/use-sprint-tasks";
import { useStartSprint } from "../hooks/use-start-sprint";
import { useUpdateSprint } from "../hooks/use-update-sprint";
import type { SprintFormData } from "../validation/sprint";

import { SprintFormPanel } from "./form";
import { AssignTaskCommand, SprintPreviewPanel } from "./preview";
import { SprintsTable } from "./table";

interface SprintsViewProps {
  projectId: string;
}

// The only stateful Sprints-tab component. Owns the list query, all six
// mutations, and every panel's open/selection state - SprintsTable/SprintRow/
// SprintForm/SprintFormPanel/SprintPreviewPanel/SprintTaskList/
// AssignTaskCommand are presentational and never call a hook from ../hooks or
// ../api directly (mirrors CommentsPanel/AttachmentsPanel).
export function SprintsView({ projectId }: SprintsViewProps) {
  const sprintsQuery = useSprints(projectId);
  const createSprint = useCreateSprint(projectId);
  const updateSprint = useUpdateSprint();
  const startSprint = useStartSprint();
  const completeSprint = useCompleteSprint();
  const assignTaskToSprint = useAssignTaskToSprint();
  const removeTaskFromSprint = useRemoveTaskFromSprint();

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedSprintTrigger, setSelectedSprintTrigger] = useState<HTMLButtonElement | null>(
    null,
  );

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);

  const sprints = sprintsQuery.data ?? [];
  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) ?? null;

  // Only trustworthy while a sprint is selected - useSprintTasks(undefined)
  // stays disabled via the hook's own `enabled: Boolean(sprintId)`.
  const sprintTasksQuery = useSprintTasks(selectedSprintId ?? undefined);
  const sprintTasks = sprintTasksQuery.data ?? [];

  // The standard project-task endpoint never returns sprintId (verified
  // against task.service.ts's toTaskResponse), so "already in this sprint"
  // can only be determined by id, cross-referenced against sprintTasksQuery
  // (which does carry a real sprintId, since it comes from the raw-row
  // sprint-task endpoints) - never by reading .sprintId off a projectTasks
  // entry, which is always null.
  const projectTasksQuery = useProjectTasks(projectId);
  const assignableTasks = useMemo(() => {
    const sprintTaskIds = new Set((sprintTasksQuery.data ?? []).map((task) => task.id));
    return (projectTasksQuery.data ?? []).filter((task) => !sprintTaskIds.has(task.id));
  }, [projectTasksQuery.data, sprintTasksQuery.data]);

  const handleSprintSelect = (sprintId: string, trigger: HTMLButtonElement | null) => {
    setSelectedSprintId(sprintId);
    setSelectedSprintTrigger(trigger);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => setIsPreviewOpen(false);

  const handlePreviewCloseAutoFocus = () => {
    selectedSprintTrigger?.focus();
    setSelectedSprintId(null);
    setSelectedSprintTrigger(null);
  };

  const handleCreateSprint = (trigger: HTMLButtonElement) => {
    setEditingSprintId(null);
    setFormMode("create");
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  // Reuses the row's own trigger (selectedSprintTrigger), not the preview
  // panel's Edit button - the preview Sheet unmounts as soon as the edit
  // panel opens, so a trigger sourced from inside it would be a detached
  // node by the time the edit panel closes and tries to focus it back.
  const handleEditSprint = () => {
    setEditingSprintId(selectedSprintId);
    setFormMode("edit");
    setFormPanelTrigger(selectedSprintTrigger);
    setIsPreviewOpen(false);
    setIsFormPanelOpen(true);
  };

  const handleFormPanelClose = () => setIsFormPanelOpen(false);

  const handleFormPanelCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setEditingSprintId(null);
    setFormMode(null);
    setFormPanelTrigger(null);
  };

  const handleSprintFormSubmit = async (data: SprintFormData) => {
    if (formMode === "create") {
      await createSprint.mutateAsync({
        name: data.name,
        goal: data.goal || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      });
    }

    if (formMode === "edit" && editingSprintId) {
      await updateSprint.mutateAsync({
        sprintId: editingSprintId,
        projectId,
        input: {
          name: data.name,
          goal: data.goal || null,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
        },
      });
    }

    handleFormPanelClose();
  };

  // Panel stays open on success (unlike archive/delete elsewhere, which
  // close their panel) - the point is to let the user see the sprint's
  // status update live once the mutation's invalidation refetches.
  const handleStartSprint = async () => {
    if (!selectedSprintId) {
      return;
    }

    try {
      await startSprint.mutateAsync({ sprintId: selectedSprintId, projectId });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  const handleCompleteSprint = async () => {
    if (!selectedSprintId) {
      return;
    }

    try {
      await completeSprint.mutateAsync({ sprintId: selectedSprintId, projectId });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  const handleOpenAssignDialog = () => setIsAssignDialogOpen(true);

  // AssignTaskCommand's onOpenChange is passed setIsAssignDialogOpen
  // directly below (no wrapper needed) - unlike handleEditSprint, there's no
  // trigger to capture/restore here: the "Assign task" button lives inside
  // the preview Sheet, which never closes during this flow (only the
  // CommandDialog opens on top of it and closes again), so Radix's own
  // default focus-restore already returns focus to it correctly without any
  // manual tracking (same reason SearchCommand doesn't track a trigger
  // either - its triggers are likewise always still mounted when the dialog
  // closes).

  const handleAssignTask = async (taskId: string) => {
    if (!selectedSprintId) {
      return;
    }

    setIsAssignDialogOpen(false);

    try {
      await assignTaskToSprint.mutateAsync({ sprintId: selectedSprintId, taskId, projectId });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    if (!selectedSprintId) {
      return;
    }

    setRemovingTaskId(taskId);

    try {
      await removeTaskFromSprint.mutateAsync({ sprintId: selectedSprintId, taskId, projectId });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    } finally {
      setRemovingTaskId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Sprints</h2>
        <Button type="button" onClick={(event) => handleCreateSprint(event.currentTarget)}>
          Create sprint
        </Button>
      </div>

      <div className="mt-3">
        <SprintsTable
          sprints={sprints}
          selectedSprintId={selectedSprintId}
          isLoading={sprintsQuery.isLoading}
          error={sprintsQuery.error?.message ?? null}
          onSprintSelect={handleSprintSelect}
          onRetry={() => sprintsQuery.refetch()}
          onCreateSprint={handleCreateSprint}
        />
      </div>

      <SprintPreviewPanel
        sprint={selectedSprint}
        open={isPreviewOpen}
        isStarting={startSprint.isPending}
        isCompleting={completeSprint.isPending}
        sprintTasks={sprintTasks}
        isSprintTasksLoading={sprintTasksQuery.isLoading}
        isSprintTasksError={sprintTasksQuery.isError}
        removingTaskId={removingTaskId}
        onRetrySprintTasks={() => sprintTasksQuery.refetch()}
        onRemoveTask={handleRemoveTask}
        onAssignTask={handleOpenAssignDialog}
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onEdit={handleEditSprint}
        onStart={handleStartSprint}
        onComplete={handleCompleteSprint}
      />

      <AssignTaskCommand
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        assignableTasks={assignableTasks}
        isLoading={projectTasksQuery.isLoading || sprintTasksQuery.isLoading}
        isError={projectTasksQuery.isError || sprintTasksQuery.isError}
        onRetry={() => {
          projectTasksQuery.refetch();
          sprintTasksQuery.refetch();
        }}
        onAssign={handleAssignTask}
      />

      <SprintFormPanel
        mode={formMode}
        sprint={sprints.find((sprint) => sprint.id === editingSprintId) ?? null}
        open={isFormPanelOpen}
        onClose={handleFormPanelClose}
        onCloseAutoFocus={handleFormPanelCloseAutoFocus}
        onSubmit={handleSprintFormSubmit}
      />
    </>
  );
}
