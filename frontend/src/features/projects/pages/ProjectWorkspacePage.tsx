import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { SearchX, TriangleAlert } from "lucide-react";

import { Button, Skeleton } from "@/components/ui";
import { PageLayout } from "@/components/layout";
import { ErrorState, PageError } from "@/components/ux";
import { useActiveWorkspace } from "@/features/workspaces";

import { useProjectWithTaskCounts } from "../hooks/use-project-with-task-counts";
import { useProjects } from "../hooks/use-projects";
import { useUpdateProject } from "../hooks/use-update-project";
import { ProjectFormPanel } from "../components/form";
import { ProjectHeader, ProjectNavigation, WorkspaceContent } from "../components/workspace";
import type { ProjectWorkspaceTab } from "../types";
import type { ProjectFormData } from "../validation/project";

export function ProjectWorkspacePage() {
  const { slug } = useParams();
  const location = useLocation();
  const { workspaceId } = useActiveWorkspace();
  const projectsQuery = useProjects(workspaceId ?? undefined);

  const resolvedProjectId = projectsQuery.data?.find((item) => item.project.slug === slug)?.project
    .id;

  const projectDetailQuery = useProjectWithTaskCounts(resolvedProjectId);
  const updateProject = useUpdateProject();

  // A sprint search result (see SearchCommand's handleSelectSprint) navigates
  // here with `{ state: { initialTab: "sprints" } }` instead of a URL/query
  // param, since tab selection is local component state, not
  // URL-addressable - same typed location.state narrowing idiom as
  // features/auth/lib/redirect.ts's `from`. Anything else - no state, a
  // normal navigation, or a refresh - falls back to the existing "tasks"
  // default exactly as before.
  const initialTabFromNavigation: ProjectWorkspaceTab =
    (location.state as { initialTab?: ProjectWorkspaceTab } | null)?.initialTab === "sprints"
      ? "sprints"
      : "tasks";

  const [tabSelection, setTabSelection] = useState<{
    projectSlug: string | undefined;
    tab: ProjectWorkspaceTab;
  }>({ projectSlug: slug, tab: initialTabFromNavigation });
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  // Reusing the existing slug-mismatch guard: this route element is reused
  // (not remounted) when navigating between two projects, so a plain
  // useState seed alone would miss a second sprint-search navigation that
  // lands while this page is already mounted on a different project. When
  // the tracked slug no longer matches the current one, falling back to
  // initialTabFromNavigation (rather than a hardcoded "tasks") re-derives
  // the correct tab for that case too, purely at render time - no effect.
  const activeTab =
    tabSelection.projectSlug === slug ? tabSelection.tab : initialTabFromNavigation;

  const isResolvingProject = projectsQuery.isPending;
  const isLoadingDetail = Boolean(resolvedProjectId) && projectDetailQuery.isLoading;

  if (isResolvingProject || isLoadingDetail) {
    return (
      <PageLayout>
        <div className="flex flex-col gap-3 py-4" aria-busy="true">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </PageLayout>
    );
  }

  const handleRetry = () => {
    if (projectsQuery.isError) {
      projectsQuery.refetch();
      return;
    }

    projectDetailQuery.refetch();
  };

  if (projectsQuery.isError || projectDetailQuery.isError) {
    return (
      <PageError>
        <ErrorState
          icon={TriangleAlert}
          title="Unable to load project"
          description="Something went wrong while loading this project. Check your connection and try again."
          action={
            <Button type="button" onClick={handleRetry}>
              Retry
            </Button>
          }
        />
      </PageError>
    );
  }

  const project = projectDetailQuery.data?.project;

  if (!project) {
    return (
      <PageError>
        <ErrorState
          icon={SearchX}
          title="Project not found"
          description="This project may have been removed or you may not have access to it."
          action={
            <Button asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </PageError>
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
      <WorkspaceContent project={project} workspaceId={workspaceId ?? ""} activeTab={activeTab} />

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
