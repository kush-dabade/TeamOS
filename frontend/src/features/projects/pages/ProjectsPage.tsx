import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageLayout } from "@/components/layout";
import { useAuth } from "@/features/auth";
import { useCurrentWorkspace } from "@/features/workspaces";

import { useArchiveProject } from "../hooks/use-archive-project";
import { useCreateProject } from "../hooks/use-create-project";
import { useProject } from "../hooks/use-project";
import { useProjectsWithTaskCounts } from "../hooks/use-projects-with-task-counts";
import { useUpdateProject } from "../hooks/use-update-project";
import { ProjectFormPanel } from "../components/form";
import { ProjectPreviewPanel } from "../components/preview";
import { ProjectsTable } from "../components/table";
import { ProjectsToolbar } from "../components/toolbar";
import type {
  Project,
  ProjectListItem,
  ProjectSortOption,
  ProjectStatusFilter,
} from "../types";
import type { ProjectFormData } from "../validation/project";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const workspaceQuery = useCurrentWorkspace();
  const workspace = workspaceQuery.data;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("ALL");
  const [sortOption, setSortOption] = useState<ProjectSortOption>("RECENTLY_UPDATED");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedProjectTrigger, setSelectedProjectTrigger] = useState<HTMLButtonElement | null>(
    null,
  );
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const projectsQuery = useProjectsWithTaskCounts(
    workspace?.id,
    statusFilter === "ALL" ? undefined : statusFilter,
  );
  const projectItems = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const selectedProjectPreviewQuery = useProject(selectedProjectId ?? undefined);

  const createProject = useCreateProject(workspace?.id ?? "");
  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();

  const projects = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return projectItems
      .filter(({ project }) => project.name.toLowerCase().includes(normalizedSearchQuery))
      .sort((firstProject, secondProject) => {
        if (sortOption === "NAME_ASC") {
          return firstProject.project.name.localeCompare(secondProject.project.name);
        }

        if (sortOption === "NAME_DESC") {
          return secondProject.project.name.localeCompare(firstProject.project.name);
        }

        return (
          new Date(secondProject.project.updatedAt).getTime() -
          new Date(firstProject.project.updatedAt).getTime()
        );
      });
  }, [projectItems, searchQuery, sortOption]);

  const handleRetry = () => {
    if (workspaceQuery.isError) {
      workspaceQuery.refetch();
      return;
    }

    projectsQuery.refetch();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
  };

  const selectedProject = projectItems.find(
    ({ project }) => project.id === selectedProjectId,
  );
  const selectedProjectPreviewData = selectedProjectPreviewQuery.data?.previewData ?? null;

  const handleProjectSelect = (projectId: string, trigger: HTMLButtonElement | null) => {
    setSelectedProjectId(projectId);
    setSelectedProjectTrigger(trigger);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => setIsPreviewOpen(false);

  const handlePreviewCloseAutoFocus = () => {
    selectedProjectTrigger?.focus();
    setSelectedProjectId(null);
    setSelectedProjectTrigger(null);
  };

  const handleNewProject = (trigger: HTMLButtonElement) => {
    setEditingProjectId(null);
    setFormMode("create");
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleEditProject = (trigger: HTMLButtonElement) => {
    setEditingProjectId(selectedProjectId);
    setFormMode("edit");
    setFormPanelTrigger(trigger);
    setIsPreviewOpen(false);
    setIsFormPanelOpen(true);
  };

  const handleFormPanelClose = () => setIsFormPanelOpen(false);

  const handleFormPanelCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setEditingProjectId(null);
    setFormMode(null);
    setFormPanelTrigger(null);
  };

  const handleProjectFormSubmit = async (data: ProjectFormData) => {
    if (formMode === "create") {
      if (!workspace || !user) {
        return;
      }

      await createProject.mutateAsync({
        ownerId: user.id,
        name: data.name,
        description: data.description || undefined,
      });
    }

    if (formMode === "edit" && editingProjectId) {
      await updateProject.mutateAsync({
        projectId: editingProjectId,
        input: {
          name: data.name,
          description: data.description || null,
          status: data.status,
        },
      });
    }

    handleFormPanelClose();
  };

  const handleArchiveProject = async () => {
    if (!selectedProjectId) {
      return;
    }

    try {
      await archiveProject.mutateAsync(selectedProjectId);
      handlePreviewClose();
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  };

  return (
    <PageLayout>
      <div className="mt-3">
        <ProjectsToolbar
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sortOption={sortOption}
          onSearchQueryChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onSortOptionChange={setSortOption}
          onNewProject={handleNewProject}
        />

        <div className="mt-4">
          <ProjectsTable
            projects={projects}
            selectedProjectId={selectedProjectId}
            isLoading={workspaceQuery.isLoading || projectsQuery.isLoading}
            error={
              workspaceQuery.isError ? workspaceQuery.error.message : (projectsQuery.error?.message ?? null)
            }
            hasActiveFilters={Boolean(searchQuery.trim()) || statusFilter !== "ALL"}
            onProjectSelect={handleProjectSelect}
            onRetry={handleRetry}
            onNewProject={handleNewProject}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      <ProjectPreviewPanel
        project={selectedProject ?? null}
        previewData={selectedProjectPreviewData}
        isPreviewLoading={selectedProjectPreviewQuery.isLoading}
        isArchiving={archiveProject.isPending}
        open={isPreviewOpen}
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onOpenProject={(slug) => navigate(`/projects/${slug}`)}
        onEdit={handleEditProject}
        onArchive={handleArchiveProject}
      />

      <ProjectFormPanel
        mode={formMode}
        project={findProject(editingProjectId, projectItems)}
        open={isFormPanelOpen}
        onClose={handleFormPanelClose}
        onCloseAutoFocus={handleFormPanelCloseAutoFocus}
        onSubmit={handleProjectFormSubmit}
      />
    </PageLayout>
  );
}

function findProject(projectId: string | null, projects: ProjectListItem[]): Project | null {
  return projects.find((item) => item.project.id === projectId)?.project ?? null;
}
