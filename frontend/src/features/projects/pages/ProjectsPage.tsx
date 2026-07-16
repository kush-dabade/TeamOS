import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageLayout } from "@/components/layout";
import { useAuth } from "@/features/auth";

import { mockProjectPreviewData, mockProjects } from "../data/projects.mock";
import { ProjectFormPanel } from "../components/form";
import { ProjectPreviewPanel } from "../components/preview";
import { ProjectsTable } from "../components/table";
import { ProjectsToolbar } from "../components/toolbar";
import type {
  Project,
  ProjectListItem,
  ProjectPreviewData,
  ProjectSortOption,
  ProjectStatusFilter,
} from "../types";
import type { ProjectFormData } from "../validation/project";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projectItems, setProjectItems] = useState<ProjectListItem[]>(mockProjects);
  const [projectPreviewData, setProjectPreviewData] = useState<Record<string, ProjectPreviewData>>(
    mockProjectPreviewData,
  );
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
  const [error, setError] = useState<string | null>(null);

  const projects = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return projectItems
      .filter(({ project }) => {
        const matchesSearch = project.name.toLowerCase().includes(normalizedSearchQuery);
        const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
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
  }, [projectItems, searchQuery, sortOption, statusFilter]);

  const handleRetry = () => setError(null);

  const selectedProject = projectItems.find(
    ({ project }) => project.id === selectedProjectId,
  );
  const selectedProjectPreviewData = selectedProject
    ? projectPreviewData[selectedProject.project.id]
    : null;

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

  const handleProjectFormSubmit = (data: ProjectFormData) => {
    const now = new Date().toISOString();

    if (formMode === "create") {
      const id = crypto.randomUUID();
      const slug = createProjectSlug(data.name, projectItems);

      setProjectItems((currentProjects) => [
        {
          project: {
            id,
            slug,
            name: data.name,
            description: data.description || null,
            status: data.status,
            createdAt: now,
            updatedAt: now,
          },
          completedTaskCount: 0,
          totalTaskCount: 0,
        },
        ...currentProjects,
      ]);
      setProjectPreviewData((currentPreviewData) => ({
        ...currentPreviewData,
        [id]: {
          ownerName: user?.name ?? "TeamOS User",
          startDate: null,
          targetDate: null,
        },
      }));
    }

    if (formMode === "edit" && editingProjectId) {
      setProjectItems((currentProjects) =>
        currentProjects.map((item) =>
          item.project.id === editingProjectId
            ? {
                ...item,
                project: {
                  ...item.project,
                  name: data.name,
                  description: data.description || null,
                  status: data.status,
                  updatedAt: now,
                },
              }
            : item,
        ),
      );
    }

    handleFormPanelClose();
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
            isLoading={false}
            error={error}
            onProjectSelect={handleProjectSelect}
            onRetry={handleRetry}
          />
        </div>
      </div>

      <ProjectPreviewPanel
        project={selectedProject ?? null}
        previewData={selectedProjectPreviewData ?? null}
        open={isPreviewOpen}
        onClose={handlePreviewClose}
        onCloseAutoFocus={handlePreviewCloseAutoFocus}
        onOpenProject={(slug) => navigate(`/projects/${slug}`)}
        onEdit={handleEditProject}
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

function createProjectSlug(name: string, projects: ProjectListItem[]) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
  const existingSlugs = new Set(projects.map(({ project }) => project.slug));

  let slug = baseSlug;
  let suffix = 2;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function findProject(projectId: string | null, projects: ProjectListItem[]): Project | null {
  return projects.find((item) => item.project.id === projectId)?.project ?? null;
}
