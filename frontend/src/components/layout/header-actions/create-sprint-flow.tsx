import { useState } from "react";

import { SprintFormPanel, useCreateSprint, type SprintFormData } from "@/features/sprints";
import type { TaskProject } from "@/features/tasks";

import { SprintProjectPicker } from "./sprint-project-picker";

interface CreateSprintFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  projects: TaskProject[];
  isProjectsLoading: boolean;
  isProjectsError: boolean;
  onRetryProjects: () => void;
}

// Sprint creation is two steps from the global menu (unlike Project/Task):
// the existing SprintForm has no project field of its own (SprintForm.tsx),
// and useCreateSprint(projectId) fixes its project at the hook-call site
// rather than accepting it per-submission, so a valid projectId has to exist
// *before* that hook is called at all. Splitting the "pick a project" step
// into its own mounted-only-once-chosen child keeps that hook call always
// backed by a real id instead of a placeholder empty string.
export function CreateSprintFlow({
  open,
  onOpenChange,
  onCloseAutoFocus,
  projects,
  isProjectsLoading,
  isProjectsError,
  onRetryProjects,
}: CreateSprintFlowProps) {
  const [projectId, setProjectId] = useState<string | null>(null);

  const close = () => {
    onOpenChange(false);
    setProjectId(null);
  };

  return (
    <>
      <SprintProjectPicker
        open={open && !projectId}
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
        projects={projects}
        isLoading={isProjectsLoading}
        isError={isProjectsError}
        onRetry={onRetryProjects}
        onSelect={setProjectId}
      />

      {projectId ? (
        <SprintCreatePanel
          projectId={projectId}
          open={open}
          onClose={close}
          onCloseAutoFocus={onCloseAutoFocus}
        />
      ) : null}
    </>
  );
}

interface SprintCreatePanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
}

function SprintCreatePanel({ projectId, open, onClose, onCloseAutoFocus }: SprintCreatePanelProps) {
  const createSprint = useCreateSprint(projectId);

  const handleSubmit = async (data: SprintFormData) => {
    await createSprint.mutateAsync({
      name: data.name,
      goal: data.goal || undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });
    onClose();
  };

  return (
    <SprintFormPanel
      mode="create"
      sprint={null}
      open={open}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
      onSubmit={handleSubmit}
    />
  );
}
