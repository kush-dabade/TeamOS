import { BriefcaseBusiness, TriangleAlert } from "lucide-react";

import {
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Skeleton,
} from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/ux";
import type { TaskProject } from "@/features/tasks";

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

interface SprintProjectPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: TaskProject[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (projectId: string) => void;
}

// Mirrors AssignTaskCommand's shape (client-side list, cmdk's own fuzzy
// filter, no debounce/server query) - same "pick one item from an
// already-loaded list" pattern, applied to projects instead of tasks.
export function SprintProjectPicker({
  open,
  onOpenChange,
  projects,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: SprintProjectPickerProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New sprint"
      description="Choose a project for the new sprint."
      className="sm:max-w-md"
    >
      <Command label="Choose a project">
        <CommandInput placeholder="Search projects..." />

        <CommandList>
          <CommandEmpty>
            {isError ? (
              <ErrorState
                icon={TriangleAlert}
                title="Couldn't load projects"
                description="Something went wrong while loading your projects."
                action={
                  <Button type="button" variant="outline" onClick={onRetry}>
                    Retry
                  </Button>
                }
              />
            ) : isLoading ? (
              <div className="space-y-1 py-1">
                {skeletonRows.map((row) => (
                  <div key={row} className="flex items-center gap-2.5 px-2 py-2">
                    <Skeleton className="size-4 shrink-0 rounded" />
                    <Skeleton className="h-3.5 flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BriefcaseBusiness}
                title="No projects yet"
                description="Create a project first, then you can add a sprint to it."
              />
            )}
          </CommandEmpty>

          {!isLoading && !isError ? (
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.name}-${project.id}`}
                  onSelect={() => onSelect(project.id)}
                  className="items-start gap-2.5 py-2"
                >
                  <BriefcaseBusiness
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
