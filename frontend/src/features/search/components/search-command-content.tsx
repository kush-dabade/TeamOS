import { useState } from "react";
import { FolderIcon, ListTodoIcon, SearchIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
  Skeleton,
} from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";

import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useSearch } from "../hooks/use-search";
import { SearchResultItem } from "./search-result-item";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const loadingRows = Array.from({ length: 3 }, (_, index) => index);

interface SearchCommandContentProps {
  workspaceId: string | undefined;
  onSelectProject: (slug: string) => void;
  onSelectTask: (taskId: string) => void;
}

// SearchCommand gives this a fresh `key` every time the dialog closes, so it
// unmounts and remounts rather than persisting - query/debounce state starts
// clean on every open by construction, with nothing to reset by hand.
export function SearchCommandContent({
  workspaceId,
  onSelectProject,
  onSelectTask,
}: SearchCommandContentProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();

  // Debouncing the already-trimmed value (not the raw one) means
  // leading/trailing-whitespace-only edits don't reset the timer or key a
  // "new" (but functionally identical) search.
  const debouncedQuery = useDebouncedValue(trimmedQuery, DEBOUNCE_MS);
  const isQueryReady = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useSearch({
    workspaceId,
    query: debouncedQuery,
    enabled: isQueryReady,
  });

  const projects = searchQuery.data?.projects ?? [];
  const tasks = searchQuery.data?.tasks ?? [];
  const hasProjectResults = projects.length > 0;
  const hasTaskResults = tasks.length > 0;

  const firstResultValue = hasProjectResults
    ? `project-${projects[0].id}`
    : hasTaskResults
      ? `task-${tasks[0].id}`
      : "";

  const [selectedValue, setSelectedValue] = useState(firstResultValue);
  const [syncedResultValue, setSyncedResultValue] = useState(firstResultValue);

  // cmdk only auto-selects the first item when nothing is currently
  // selected. With shouldFilter={false} and a server-driven item set that's
  // unmounted/remounted wholesale on every debounced fetch (rather than
  // cmdk's usual static-list-plus-filter model), that guard never fires
  // again once anything has been selected - so once a later result set
  // replaces an earlier one, the highlight can keep pointing at an item
  // that no longer exists, and Enter silently does nothing until an arrow
  // key is pressed.
  //
  // Re-deriving during render (see workspace-provider.tsx for the same
  // pattern) rather than in an effect settles this within the same render
  // the result set changes in. `syncedResultValue` tracks the last result
  // set we synced against, so this only overrides `selectedValue` when the
  // top result's identity actually changes - not on every render - which
  // is what keeps this from fighting manual arrow-key selection in between
  // changes.
  if (firstResultValue !== syncedResultValue) {
    setSyncedResultValue(firstResultValue);
    setSelectedValue(firstResultValue);
  }

  function renderEmptyState() {
    if (!isQueryReady) {
      return (
        <EmptyState
          icon={SearchIcon}
          title="Search TeamOS"
          description="Find projects and tasks by name. Keep typing to search."
        />
      );
    }

    if (searchQuery.isError) {
      return (
        <ListErrorState
          title="Couldn't load results"
          description={searchQuery.error.message}
          onRetry={() => searchQuery.refetch()}
        />
      );
    }

    if (searchQuery.isLoading) {
      return (
        <div className="space-y-1 px-2 py-1">
          {loadingRows.map((row) => (
            <div key={row} className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <EmptyState
        icon={SearchIcon}
        title="No results found"
        description={`No projects or tasks match "${debouncedQuery}".`}
      />
    );
  }

  return (
    <Command
      shouldFilter={false}
      vimBindings={false}
      label="Search projects and tasks"
      value={selectedValue}
      onValueChange={setSelectedValue}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search projects and tasks..."
      />

      <CommandList>
        <CommandEmpty>{renderEmptyState()}</CommandEmpty>

        {hasProjectResults ? (
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <SearchResultItem
                key={project.id}
                value={`project-${project.id}`}
                icon={FolderIcon}
                title={project.name}
                description={project.description}
                onSelect={() => onSelectProject(project.slug)}
              />
            ))}
          </CommandGroup>
        ) : null}

        {hasProjectResults && hasTaskResults ? <CommandSeparator /> : null}

        {hasTaskResults ? (
          <CommandGroup heading="Tasks">
            {tasks.map((task) => (
              <SearchResultItem
                key={task.id}
                value={`task-${task.id}`}
                icon={ListTodoIcon}
                title={task.title}
                description={task.description}
                onSelect={() => onSelectTask(task.id)}
              />
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}
