import { Button, Input } from "@/components/ui";

import type { ProjectSortOption, ProjectStatusFilter } from "../../types";

interface ProjectsToolbarProps {
  searchQuery: string;
  statusFilter: ProjectStatusFilter;
  sortOption: ProjectSortOption;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: ProjectStatusFilter) => void;
  onSortOptionChange: (value: ProjectSortOption) => void;
  onNewProject: (trigger: HTMLButtonElement) => void;
}

export function ProjectsToolbar({
  searchQuery,
  statusFilter,
  sortOption,
  onSearchQueryChange,
  onStatusFilterChange,
  onSortOptionChange,
  onNewProject,
}: ProjectsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" onClick={(event) => onNewProject(event.currentTarget)}>
          New Project
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search projects..."
          aria-label="Search projects"
          className="sm:w-64"
        />

        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as ProjectStatusFilter)}
          aria-label="Filter projects by status"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="ALL">All</option>
          <option value="PLANNED">Planned</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select
          value={sortOption}
          onChange={(event) => onSortOptionChange(event.target.value as ProjectSortOption)}
          aria-label="Sort projects"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="RECENTLY_UPDATED">Recently Updated</option>
          <option value="NAME_ASC">Name (A–Z)</option>
          <option value="NAME_DESC">Name (Z–A)</option>
        </select>
      </div>
    </div>
  );
}
