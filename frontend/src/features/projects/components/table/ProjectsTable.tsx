import { Button } from "@/components/ui";

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
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium">Unable to load projects</p>
        <Button type="button" variant="outline" onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  if (!isLoading && projects.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">
          {hasActiveFilters ? "No projects match your filters" : "No projects yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Try adjusting your search or status filter."
            : "Create your first project to start organizing work."}
        </p>
        {hasActiveFilters ? (
          <Button type="button" variant="outline" className="mt-2" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button type="button" className="mt-2" onClick={(event) => onNewProject(event.currentTarget)}>
            New Project
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full border-collapse text-sm">
        <caption className="sr-only">Projects</caption>
        <thead className="sticky top-0 z-10 border-b bg-background/95 text-left text-xs font-medium text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="w-[36%] px-3 py-2.5 font-medium">Project</th>
            <th scope="col" className="w-28 px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-40 px-3 py-2.5 font-medium">Progress</th>
            <th scope="col" className="w-28 px-3 py-2.5 font-medium">Tasks</th>
            <th scope="col" className="w-28 px-3 py-2.5 font-medium">Updated</th>
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
