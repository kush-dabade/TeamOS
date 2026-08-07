import { Rocket, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/ux";

import type { Sprint } from "../../types";

import { SprintRow } from "./SprintRow";
import { SprintsTableSkeleton } from "./SprintsTableSkeleton";

interface SprintsTableProps {
  sprints: Sprint[];
  selectedSprintId: string | null;
  isLoading: boolean;
  error: string | null;
  onSprintSelect: (sprintId: string, trigger: HTMLButtonElement | null) => void;
  onRetry: () => void;
  onCreateSprint: (trigger: HTMLButtonElement) => void;
}

export function SprintsTable({
  sprints,
  selectedSprintId,
  isLoading,
  error,
  onSprintSelect,
  onRetry,
  onCreateSprint,
}: SprintsTableProps) {
  if (error) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <ErrorState
          icon={TriangleAlert}
          title="Unable to load sprints"
          description="Something went wrong while loading sprints. Check your connection and try again."
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!isLoading && sprints.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <EmptyState
          icon={Rocket}
          title="No sprints yet"
          description="Create a sprint to start planning this project's work."
          action={
            <Button type="button" onClick={(event) => onCreateSprint(event.currentTarget)}>
              Create sprint
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table aria-busy={isLoading} className="min-w-[640px] w-full border-collapse text-sm">
        <caption className="sr-only">Sprints</caption>
        <thead className="sticky top-0 z-10 border-b bg-background/95 text-left text-xs font-medium text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="w-[36%] px-3 py-2 font-medium">Sprint</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Status</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Start Date</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">End Date</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <SprintsTableSkeleton /> : null}
          {!isLoading
            ? sprints.map((sprint) => (
                <SprintRow
                  key={sprint.id}
                  sprint={sprint}
                  isSelected={sprint.id === selectedSprintId}
                  onSelect={onSprintSelect}
                />
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
}
