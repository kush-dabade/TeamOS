import { useState } from "react";
import { CalendarRangeIcon, FolderIcon, ListTodoIcon, SearchIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
  Skeleton,
} from "@/components/ui";
import { EmptyState, ListErrorState, UserAvatar } from "@/components/ux";
import { useProjects } from "@/features/projects";
import { getUserAvatarUrl } from "@/utils";

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
  onSelectSprint: (projectSlug: string) => void;
  onSelectMember: () => void;
}

// SearchCommand gives this a fresh `key` every time the dialog closes, so it
// unmounts and remounts rather than persisting - query/debounce state starts
// clean on every open by construction, with nothing to reset by hand.
export function SearchCommandContent({
  workspaceId,
  onSelectProject,
  onSelectTask,
  onSelectSprint,
  onSelectMember,
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

  // Sprint results only carry their parent project's id, not its slug (see
  // SearchSprintResult) - the project list is already the canonical
  // workspace-scoped source for that mapping (same data ProjectWorkspacePage
  // itself resolves a slug from), so this reuses it instead of teaching the
  // backend search response to duplicate project fields it doesn't
  // otherwise need. The default (no status filter) listing already excludes
  // ARCHIVED projects, matching searchSprints' own exclusion, so every
  // sprint result's project is guaranteed to be resolvable here.
  const projectsQuery = useProjects(workspaceId);

  const projects = searchQuery.data?.projects ?? [];
  const tasks = searchQuery.data?.tasks ?? [];
  const sprints = searchQuery.data?.sprints ?? [];
  const members = searchQuery.data?.members ?? [];
  const hasProjectResults = projects.length > 0;
  const hasTaskResults = tasks.length > 0;
  const hasSprintResults = sprints.length > 0;
  const hasMemberResults = members.length > 0;

  function resolveProjectSlug(projectId: string): string | undefined {
    return projectsQuery.data?.find((item) => item.project.id === projectId)?.project.slug;
  }

  const firstResultValue = hasProjectResults
    ? `project-${projects[0].id}`
    : hasTaskResults
      ? `task-${tasks[0].id}`
      : hasSprintResults
        ? `sprint-${sprints[0].id}`
        : hasMemberResults
          ? `member-${members[0].userId}`
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

  // cmdk doesn't expose an aria-live region of its own (verified against its
  // source - there isn't one anywhere in the package), so a screen reader
  // user who isn't actively arrowing through results gets no signal that a
  // search resolved, failed, or came back empty. This announces exactly the
  // same state renderEmptyState() already branches on, once per settled
  // state rather than per keystroke, since it's derived from `debouncedQuery`
  // and query status rather than the raw input.
  const resultCount = projects.length + tasks.length + sprints.length + members.length;
  const statusMessage = !isQueryReady
    ? ""
    : searchQuery.isError
      ? "Couldn't load results."
      : searchQuery.isLoading
        ? "Searching..."
        : `${resultCount} ${resultCount === 1 ? "result" : "results"} found.`;

  function renderEmptyState() {
    if (!isQueryReady) {
      return (
        <EmptyState
          icon={SearchIcon}
          title="Search TeamOS"
          description="Find projects, tasks, sprints, and people by name. Keep typing to search."
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
        <div className="space-y-1 py-1">
          {loadingRows.map((row) => (
            <div key={row} className="flex items-start gap-2.5 px-2 py-2">
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <EmptyState
        icon={SearchIcon}
        title="No results found"
        description={`No projects, tasks, sprints, or people match "${debouncedQuery}".`}
      />
    );
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      <Command
        shouldFilter={false}
        vimBindings={false}
        label="Search projects, tasks, sprints, and people"
        value={selectedValue}
        onValueChange={setSelectedValue}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search projects, tasks, sprints, and people..."
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
                  status={task.status}
                  priority={task.priority}
                  onSelect={() => onSelectTask(task.id)}
                />
              ))}
            </CommandGroup>
          ) : null}

          {(hasProjectResults || hasTaskResults) && hasSprintResults ? (
            <CommandSeparator />
          ) : null}

          {hasSprintResults ? (
            <CommandGroup heading="Sprints">
              {sprints.map((sprint) => {
                const projectSlug = resolveProjectSlug(sprint.projectId);

                return (
                  <SearchResultItem
                    key={sprint.id}
                    value={`sprint-${sprint.id}`}
                    icon={CalendarRangeIcon}
                    title={sprint.name}
                    description={sprint.goal}
                    onSelect={() => {
                      if (projectSlug) {
                        onSelectSprint(projectSlug);
                      }
                    }}
                  />
                );
              })}
            </CommandGroup>
          ) : null}

          {(hasProjectResults || hasTaskResults || hasSprintResults) && hasMemberResults ? (
            <CommandSeparator />
          ) : null}

          {hasMemberResults ? (
            <CommandGroup heading="People">
              {members.map((member) => (
                <SearchResultItem
                  key={member.userId}
                  value={`member-${member.userId}`}
                  avatar={
                    <UserAvatar
                      name={member.name}
                      image={getUserAvatarUrl(member.userId, member.image)}
                      size="sm"
                    />
                  }
                  title={member.name}
                  description={member.email}
                  onSelect={onSelectMember}
                />
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </>
  );
}
