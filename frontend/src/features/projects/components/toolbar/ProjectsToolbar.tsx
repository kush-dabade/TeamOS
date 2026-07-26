import { SearchIcon } from "lucide-react";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

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
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div className="relative min-w-0 sm:min-w-64 sm:flex-1">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search projects..."
          aria-label="Search projects"
          className="pl-8"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as ProjectStatusFilter)}
        >
          <SelectTrigger aria-label="Filter projects by status" className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PLANNED">Planned</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={sortOption}
          onValueChange={(value) => onSortOptionChange(value as ProjectSortOption)}
        >
          <SelectTrigger aria-label="Sort projects" className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="RECENTLY_UPDATED">Recently Updated</SelectItem>
              <SelectItem value="NAME_ASC">Name (A–Z)</SelectItem>
              <SelectItem value="NAME_DESC">Name (Z–A)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        className="w-full sm:ml-auto sm:w-auto"
        onClick={(event) => onNewProject(event.currentTarget)}
      >
        New project
      </Button>
    </div>
  );
}
