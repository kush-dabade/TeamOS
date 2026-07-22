import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui";
import { PageLayout } from "@/components/layout";
import { useCurrentWorkspace } from "@/features/workspaces";

import { useProjectWithTaskCounts } from "../hooks/use-project-with-task-counts";
import { useProjects } from "../hooks/use-projects";
import { useUpdateProject } from "../hooks/use-update-project";
import { ProjectFormPanel } from "../components/form";
import { ProjectHeader, ProjectNavigation, WorkspaceContent } from "../components/workspace";
import type { ProjectWorkspaceTab } from "../types";
import type { ProjectFormData } from "../validation/project";

export function ProjectWorkspacePage() {
  const { slug } = useParams();
  const workspaceQuery = useCurrentWorkspace();
  const projectsQuery = useProjects(workspaceQuery.data?.id);

  const resolvedProjectId = projectsQuery.data?.find(
    (item) => item.project.slug === slug,
  )?.project.id;

  const projectDetailQuery = useProjectWithTaskCounts(resolvedProjectId);
  const updateProject = useUpdateProject();

  const [tabSelection, setTabSelection] = useState<{
    projectSlug: string | undefined;
    tab: ProjectWorkspaceTab;
  }>({ projectSlug: slug, tab: "tasks" });
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const activeTab = tabSelection.projectSlug === slug ? tabSelection.tab : "tasks";

  const isResolvingProject = workspaceQuery.isPending || projectsQuery.isPending;
  const isLoadingDetail = Boolean(resolvedProjectId) && projectDetailQuery.isLoading;

  if (isResolvingProject || isLoadingDetail) {
    return (
      <PageLayout>
        <p className="mt-3 text-sm text-muted-foreground">Loading project...</p>
      </PageLayout>
    );
  }

  const handleRetry = () => {
    if (workspaceQuery.isError) {
      workspaceQuery.refetch();
      return;
    }

    if (projectsQuery.isError) {
      projectsQuery.refetch();
      return;
    }

    projectDetailQuery.refetch();
  };

  if (workspaceQuery.isError || projectsQuery.isError || projectDetailQuery.isError) {
    return (
      <PageLayout>
        <div className="mt-3 flex min-h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-medium">Unable to load project</p>
          <Button type="button" variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </PageLayout>
    );
  }

  const project = projectDetailQuery.data?.project;

  if (!project) {
    return (
      <PageLayout>
        <p className="mt-3 text-sm text-muted-foreground">Project not found.</p>
      </PageLayout>
    );
  }

  const previewData = projectDetailQuery.data?.previewData ?? null;

  const handleEdit = (trigger: HTMLButtonElement) => {
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setFormPanelTrigger(null);
  };

  const handleProjectSubmit = async (data: ProjectFormData) => {
    if (!resolvedProjectId) {
      return;
    }

    await updateProject.mutateAsync({
      projectId: resolvedProjectId,
      input: {
        name: data.name,
        description: data.description || null,
        status: data.status,
      },
    });

    setIsFormPanelOpen(false);
  };

  return (
    <PageLayout>
      <ProjectHeader project={project} previewData={previewData} onEdit={handleEdit} />
      <ProjectNavigation
        activeTab={activeTab}
        onTabChange={(tab) => setTabSelection({ projectSlug: slug, tab })}
      />
      <WorkspaceContent project={project} activeTab={activeTab} />

      <ProjectFormPanel
        mode="edit"
        project={project.project}
        open={isFormPanelOpen}
        onClose={() => setIsFormPanelOpen(false)}
        onCloseAutoFocus={handleCloseAutoFocus}
        onSubmit={handleProjectSubmit}
      />
    </PageLayout>
  );
}
