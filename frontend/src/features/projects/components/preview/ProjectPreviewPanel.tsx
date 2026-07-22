import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@/components/ui";
import { formatDate, formatRelativeDate } from "@/utils";

import { ProjectStatusBadge } from "../ProjectStatusBadge";

import type { ProjectListItem, ProjectPreviewData } from "../../types";

interface ProjectPreviewPanelProps {
  project: ProjectListItem | null;
  previewData: ProjectPreviewData | null;
  isPreviewLoading: boolean;
  isArchiving: boolean;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onOpenProject: (slug: string) => void;
  onEdit: (trigger: HTMLButtonElement) => void;
  onArchive: () => void;
}

export function ProjectPreviewPanel({
  project,
  previewData,
  isPreviewLoading,
  isArchiving,
  open,
  onClose,
  onCloseAutoFocus,
  onOpenProject,
  onEdit,
  onArchive,
}: ProjectPreviewPanelProps) {
  if (!project) {
    return null;
  }

  const { completedTaskCount, progressPercentage, project: projectDetails, totalTaskCount } = project;

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
          <ProjectStatusBadge status={projectDetails.status} className="w-fit" />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {projectDetails.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{projectDetails.description}</p>
          ) : null}

          <dl className={projectDetails.description ? "mt-5 space-y-3" : "space-y-3"}>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Owner</dt>
              <dd className="text-right text-sm font-medium">
                {isPreviewLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  (previewData?.ownerName ?? "—")
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Progress</dt>
              <dd className="flex w-36 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-muted-foreground">
                  {progressPercentage}%
                </span>
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
            {previewData?.startDate ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Start</dt>
                <dd className="text-sm font-medium">{formatDate(previewData.startDate, "MMM d")}</dd>
              </div>
            ) : null}
            {previewData?.targetDate ? (
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
            <Button
              type="button"
              variant="ghost"
              onClick={onArchive}
              disabled={isArchiving || projectDetails.status === "ARCHIVED"}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </Button>
          </div>
          <Button type="button" onClick={() => onOpenProject(projectDetails.slug)}>Open Project</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
