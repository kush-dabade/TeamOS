import { useState } from "react";

import { Button } from "@/components/ui";

import { useCompleteSprint } from "../hooks/use-complete-sprint";
import { useCreateSprint } from "../hooks/use-create-sprint";
import { useSprints } from "../hooks/use-sprints";
import { useStartSprint } from "../hooks/use-start-sprint";
import { useUpdateSprint } from "../hooks/use-update-sprint";
import type { SprintFormData } from "../validation/sprint";

import { SprintFormPanel } from "./form";
import { SprintPreviewPanel } from "./preview";
import { SprintsTable } from "./table";

interface SprintsViewProps {
  projectId: string;
}

// The only stateful Sprints-tab component. Owns the list query, all four
// mutations, and every panel's open/selection state - SprintsTable/SprintRow/
// SprintForm/SprintFormPanel/SprintPreviewPanel are presentational and never
// call a hook from ../hooks or ../api directly (mirrors CommentsPanel/
// AttachmentsPanel).
export function SprintsView({ projectId }: SprintsViewProps) {
  const sprintsQuery = useSprints(projectId);
  const createSprint = useCreateSprint(projectId);
  const updateSprint = useUpdateSprint();
  const startSprint = useStartSprint();
  const completeSprint = useCompleteSprint();

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedSprintTrigger, setSelectedSprintTrigger] = useState<HTMLButtonElement | null>(
    null,
  );

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const sprints = sprintsQuery.data ?? [];
  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) ?? null;

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
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onEdit={handleEditSprint}
        onStart={handleStartSprint}
        onComplete={handleCompleteSprint}
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
