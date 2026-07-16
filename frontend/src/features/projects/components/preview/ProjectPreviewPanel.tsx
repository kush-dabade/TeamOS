import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import { formatDate, formatRelativeDate } from "@/utils";

import type { ProjectListItem, ProjectPreviewData, ProjectStatus } from "../../types";

interface ProjectPreviewPanelProps {
  project: ProjectListItem | null;
  previewData: ProjectPreviewData | null;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onOpenProject: (slug: string) => void;
  onEdit: (trigger: HTMLButtonElement) => void;
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

export function ProjectPreviewPanel({
  project,
  previewData,
  open,
  onClose,
  onCloseAutoFocus,
  onOpenProject,
  onEdit,
}: ProjectPreviewPanelProps) {
  if (!project || !previewData) {
    return null;
  }

  const { completedTaskCount, project: projectDetails, totalTaskCount } = project;
  const progress =
    totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[440px] gap-0 p-0 sm:max-w-[440px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle>{projectDetails.name}</SheetTitle>
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyles[projectDetails.status]}`}
          >
            {statusLabels[projectDetails.status]}
          </span>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {projectDetails.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{projectDetails.description}</p>
          ) : null}

          <dl className={projectDetails.description ? "mt-5 space-y-3" : "space-y-3"}>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Owner</dt>
              <dd className="text-right text-sm font-medium">{previewData.ownerName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Progress</dt>
              <dd className="flex w-36 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-muted-foreground">{progress}%</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Tasks</dt>
              <dd className="text-sm font-medium tabular-nums">
                {completedTaskCount} / {totalTaskCount}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Updated</dt>
              <dd className="text-sm font-medium">{formatRelativeDate(projectDetails.updatedAt)}</dd>
            </div>
            {previewData.startDate ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Start</dt>
                <dd className="text-sm font-medium">{formatDate(previewData.startDate, "MMM d")}</dd>
              </div>
            ) : null}
            {previewData.targetDate ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Target</dt>
                <dd className="text-sm font-medium">{formatDate(previewData.targetDate, "MMM d")}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <Separator />

        <SheetFooter className="flex-row items-center justify-between p-4">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" onClick={(event) => onEdit(event.currentTarget)}>
              Edit
            </Button>
            <Button type="button" variant="ghost">Archive</Button>
          </div>
          <Button type="button" onClick={() => onOpenProject(projectDetails.slug)}>Open Project</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
