import { useRef } from "react";

import { formatRelativeDate } from "@/utils";

import type { ProjectListItem, ProjectStatus } from "../../types";

interface ProjectRowProps {
  project: ProjectListItem;
  isSelected: boolean;
  onSelect: (projectId: string, trigger: HTMLButtonElement | null) => void;
}

const statusStyles: Record<ProjectStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ARCHIVED: "bg-secondary text-secondary-foreground",
};

const statusLabels: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function ProjectRow({ project, isSelected, onSelect }: ProjectRowProps) {
  const { completedTaskCount, project: projectDetails, totalTaskCount } = project;
  const projectNameButtonRef = useRef<HTMLButtonElement>(null);
  const progress =
    totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);

  const selectProject = () => onSelect(projectDetails.id, projectNameButtonRef.current);

  return (
    <tr
      aria-selected={isSelected}
      onClick={selectProject}
      className="h-12 cursor-pointer border-b transition-colors hover:bg-muted/50 aria-selected:bg-muted/70"
    >
      <th scope="row" className="px-3 py-2 text-left font-medium">
        <button
          type="button"
          onClick={selectProject}
          ref={projectNameButtonRef}
          className="rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {projectDetails.name}
        </button>
      </th>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyles[projectDetails.status]}`}
        >
          {statusLabels[projectDetails.status]}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex min-w-28 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <span className="w-8 text-right text-xs text-muted-foreground">{progress}%</span>
        </div>
      </td>
      <td className="px-3 py-2 text-sm tabular-nums text-muted-foreground">
        {completedTaskCount} / {totalTaskCount}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground">
        {formatRelativeDate(projectDetails.updatedAt)}
      </td>
    </tr>
  );
}
