import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageLayout } from "@/components/layout";

import { mockProjectPreviewData, mockProjects } from "../data/projects.mock";
import { ProjectPreviewPanel } from "../components/preview";
import { ProjectsTable } from "../components/table";
import { ProjectsToolbar } from "../components/toolbar";
import type { ProjectSortOption, ProjectStatusFilter } from "../types";

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("ALL");
  const [sortOption, setSortOption] = useState<ProjectSortOption>("RECENTLY_UPDATED");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedProjectTrigger, setSelectedProjectTrigger] = useState<HTMLButtonElement | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const projects = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return mockProjects
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
  }, [searchQuery, sortOption, statusFilter]);

  const handleRetry = () => setError(null);

  const selectedProject = mockProjects.find(
    ({ project }) => project.id === selectedProjectId,
  );
  const selectedProjectPreviewData = selectedProject
    ? mockProjectPreviewData[selectedProject.project.id]
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
      />
    </PageLayout>
  );
}
