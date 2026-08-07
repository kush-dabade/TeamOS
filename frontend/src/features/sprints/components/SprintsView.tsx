import { useState } from "react";

import { Button } from "@/components/ui";

import { useCreateSprint } from "../hooks/use-create-sprint";
import { useSprints } from "../hooks/use-sprints";
import type { SprintFormData } from "../validation/sprint";

import { SprintFormPanel } from "./form";
import { SprintsTable } from "./table";

interface SprintsViewProps {
  projectId: string;
}

// The only stateful Sprints-tab component. Owns the list query, the create
// mutation, and which form-panel mode (if any) is open - SprintsTable/
// SprintRow/SprintForm/SprintFormPanel are presentational and never call a
// hook from ../hooks or ../api directly (mirrors CommentsPanel/AttachmentsPanel).
export function SprintsView({ projectId }: SprintsViewProps) {
  const sprintsQuery = useSprints(projectId);
  const createSprint = useCreateSprint(projectId);

  const [formMode, setFormMode] = useState<"create" | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const sprints = sprintsQuery.data ?? [];

  const handleCreateSprint = (trigger: HTMLButtonElement) => {
    setFormMode("create");
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleFormPanelClose = () => setIsFormPanelOpen(false);

  const handleFormPanelCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setFormMode(null);
    setFormPanelTrigger(null);
  };

  const handleSprintFormSubmit = async (data: SprintFormData) => {
    await createSprint.mutateAsync({
      name: data.name,
      goal: data.goal || undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });

    handleFormPanelClose();
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
          isLoading={sprintsQuery.isLoading}
          error={sprintsQuery.error?.message ?? null}
          onRetry={() => sprintsQuery.refetch()}
          onCreateSprint={handleCreateSprint}
        />
      </div>

      <SprintFormPanel
        mode={formMode}
        sprint={null}
        open={isFormPanelOpen}
        onClose={handleFormPanelClose}
        onCloseAutoFocus={handleFormPanelCloseAutoFocus}
        onSubmit={handleSprintFormSubmit}
      />
    </>
  );
}
