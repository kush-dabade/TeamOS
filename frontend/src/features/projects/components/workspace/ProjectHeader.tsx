import { Button } from "@/components/ui";

import { ProjectStatusBadge } from "../ProjectStatusBadge";

import type { ProjectListItem, ProjectPreviewData } from "../../types";

interface ProjectHeaderProps {
  project: ProjectListItem;
  previewData: ProjectPreviewData | null;
  onEdit: (trigger: HTMLButtonElement) => void;
}

export function ProjectHeader({ project, previewData, onEdit }: ProjectHeaderProps) {
  const { completedTaskCount, project: projectDetails, totalTaskCount } = project;
  const progress =
    totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);

  return (
    <header className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{projectDetails.name}</h1>

        {projectDetails.description ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{projectDetails.description}</p>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <div className="flex w-max items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <ProjectStatusBadge status={projectDetails.status} />
            <span aria-hidden="true">•</span>
            <span>{previewData?.ownerName ?? "TeamOS User"}</span>
            <span aria-hidden="true">•</span>
            <span>{completedTaskCount} / {totalTaskCount} Tasks</span>
            <span aria-hidden="true">•</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={(event) => onEdit(event.currentTarget)}>
        Edit Project
      </Button>
    </header>
  );
}
