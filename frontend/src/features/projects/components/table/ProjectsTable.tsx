import { BriefcaseBusiness, SearchX, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/ux";

import type { ProjectListItem } from "../../types";

import { ProjectRow } from "./ProjectRow";
import { ProjectsTableSkeleton } from "./ProjectsTableSkeleton";

interface ProjectsTableProps {
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  onProjectSelect: (projectId: string, trigger: HTMLButtonElement | null) => void;
  onRetry: () => void;
  onNewProject: (trigger: HTMLButtonElement) => void;
  onClearFilters: () => void;
}

export function ProjectsTable({
  projects,
  selectedProjectId,
  isLoading,
  error,
  hasActiveFilters,
  onProjectSelect,
  onRetry,
  onNewProject,
  onClearFilters,
}: ProjectsTableProps) {
  if (error) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <ErrorState
          icon={TriangleAlert}
          title="Unable to load projects"
          description="Something went wrong while loading projects. Check your connection and try again."
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!isLoading && projects.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        {hasActiveFilters ? (
          <EmptyState
            icon={SearchX}
            title="No projects match your filters"
            description="Try adjusting your search or status filter."
            action={
              <Button type="button" variant="outline" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No projects yet"
            description="Create your first project to start organizing work."
            action={
              <Button type="button" onClick={(event) => onNewProject(event.currentTarget)}>
                New project
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table aria-busy={isLoading} className="min-w-[720px] w-full border-collapse text-sm">
        <caption className="sr-only">Projects</caption>
        <thead className="sticky top-0 z-10 border-b bg-background/95 text-left text-xs font-medium text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="w-[36%] px-3 py-2 font-medium">Project</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Status</th>
            <th scope="col" className="w-40 px-3 py-2 font-medium">Progress</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Tasks</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <ProjectsTableSkeleton /> : null}
          {!isLoading
            ? projects.map((project) => (
                <ProjectRow
                  key={project.project.id}
                  project={project}
                  isSelected={project.project.id === selectedProjectId}
                  onSelect={onProjectSelect}
                />
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
}
