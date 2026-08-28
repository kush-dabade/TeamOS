import { useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@/components/ui";
import { useWorkspaceMembers, type WorkspaceRole } from "@/features/workspaces";
import { isEligibleOwnershipTransferTarget } from "@/features/workspaces/lib/workspace-roles";
import { formatDate, formatRelativeDate } from "@/utils";

import { ProjectStatusBadge } from "../ProjectStatusBadge";

import { TransferProjectOwnershipDialog } from "./TransferProjectOwnershipDialog";

import type { ProjectListItem, ProjectPreviewData } from "../../types";

interface ProjectPreviewPanelProps {
  project: ProjectListItem | null;
  previewData: ProjectPreviewData | null;
  isPreviewLoading: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
  workspaceId: string;
  actorRole: WorkspaceRole | undefined;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onOpenProject: (slug: string) => void;
  onEdit: (trigger: HTMLButtonElement) => void;
  onArchive: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
}

export function ProjectPreviewPanel({
  project,
  previewData,
  isPreviewLoading,
  isArchiving,
  isRestoring,
  workspaceId,
  actorRole,
  open,
  onClose,
  onCloseAutoFocus,
  onOpenProject,
  onEdit,
  onArchive,
  onRestore,
}: ProjectPreviewPanelProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const actionsMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const membersQuery = useWorkspaceMembers(workspaceId);

  if (!project) {
    return null;
  }

  const { completedTaskCount, progressPercentage, project: projectDetails, totalTaskCount } = project;
  const isArchived = projectDetails.status === "ARCHIVED";

  // Visible only to OWNER/ADMIN, and only when there's at least one eligible
  // target - mirrors WorkspaceMemberRow's canTransferOwnership gating. The
  // backend remains authoritative regardless of this check.
  const canTransferOwnership =
    (actorRole === "OWNER" || actorRole === "ADMIN") &&
    previewData !== null &&
    (membersQuery.data ?? []).some(
      (member) =>
        isEligibleOwnershipTransferTarget(member.role) && member.userId !== previewData.ownerId,
    );

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
          {/* Edit/Transfer/Archive collapse into one overflow menu, the same
              pattern WorkspaceMemberRow uses for its own (also
              Transfer-ownership-inclusive) action set - a fixed ~440px-wide
              sheet has no viewport breakpoint to grow into, so adding
              Transfer ownership as a fourth visible button here would
              overflow on every screen size, not just small ones. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={actionsMenuTriggerRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Project actions"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
              {isArchived ? null : (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    if (actionsMenuTriggerRef.current) {
                      onEdit(actionsMenuTriggerRef.current);
                    }
                  }}
                >
                  Edit
                </DropdownMenuItem>
              )}

              {canTransferOwnership ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setIsTransferOpen(true);
                  }}
                >
                  Transfer ownership
                </DropdownMenuItem>
              ) : null}

              {isArchived ? (
                <DropdownMenuItem
                  disabled={isRestoring}
                  onSelect={(event) => {
                    event.preventDefault();
                    onRestore();
                  }}
                >
                  {isRestoring ? "Restoring..." : "Restore"}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isArchiving}
                  onSelect={(event) => {
                    event.preventDefault();
                    setIsConfirmOpen(true);
                  }}
                >
                  {isArchiving ? "Archiving..." : "Archive"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" onClick={() => onOpenProject(projectDetails.slug)}>Open project</Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive &quot;{projectDetails.name}&quot;. Archived projects can no longer
              be edited, and their tasks can no longer be created, updated, or deleted. You can
              restore the project later to make it active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isArchiving}
              onClick={async (event) => {
                // Prevent Radix's default auto-close so the dialog stays
                // open (showing the pending state, both actions disabled)
                // for the duration of the archive instead of closing
                // immediately into a state that looks finished while the
                // mutation is still in flight. onArchive's own caller
                // already catches its errors, so this always settles.
                event.preventDefault();
                await onArchive();
                setIsConfirmOpen(false);
              }}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canTransferOwnership && previewData !== null ? (
        <TransferProjectOwnershipDialog
          projectId={projectDetails.id}
          projectName={projectDetails.name}
          workspaceId={workspaceId}
          currentOwnerId={previewData.ownerId}
          open={isTransferOpen}
          onOpenChange={setIsTransferOpen}
        />
      ) : null}
    </Sheet>
  );
}
