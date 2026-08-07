import { ListTodo, TriangleAlert } from "lucide-react";

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
import type { Task } from "@/features/tasks";

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

interface AssignTaskCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignableTasks: Task[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onAssign: (taskId: string) => void;
}

// Unlike SearchCommandContent, the candidate list is already fully loaded
// client-side (a project's own tasks) - no debounce/server-query needed,
// just cmdk's default built-in fuzzy filter over each item's `value`.
export function AssignTaskCommand({
  open,
  onOpenChange,
  assignableTasks,
  isLoading,
  isError,
  onRetry,
  onAssign,
}: AssignTaskCommandProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign task"
      description="Search this project's tasks to add to the sprint."
      className="sm:max-w-md"
    >
      <Command label="Assign task to sprint">
        <CommandInput placeholder="Search tasks..." />

        <CommandList>
          <CommandEmpty>
            {isError ? (
              <ErrorState
                icon={TriangleAlert}
                title="Couldn't load tasks"
                description="Something went wrong while loading this project's tasks."
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
              // This also renders when a typed search matches nothing, not
              // only when there are zero assignable tasks - cmdk fires
              // CommandEmpty for either case, and this component doesn't
              // track the query text to tell them apart (deliberately -
              // unlike SearchCommandContent, filtering here is cmdk's own
              // built-in default, not a server query), so the copy has to
              // stay true under both.
              <EmptyState
                icon={ListTodo}
                title="No matching tasks"
                description="Try a different search, or every task in this project may already be in this sprint."
              />
            )}
          </CommandEmpty>

          {!isLoading && !isError ? (
            <CommandGroup heading="Tasks">
              {assignableTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`${task.title}-${task.id}`}
                  onSelect={() => onAssign(task.id)}
                  className="items-start gap-2.5 py-2"
                >
                  <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm">{task.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
