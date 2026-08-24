import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon } from "lucide-react";

import { Button, CommandDialog } from "@/components/ui";
import { useActiveWorkspace } from "@/features/workspaces";

import { SearchCommandContent } from "./search-command-content";

const isAppleDevice =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const shortcutLabel = isAppleDevice ? "⌘K" : "Ctrl + K";

function isEditableElement(element: Element | null): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return true;
  }

  return element instanceof HTMLElement && element.isContentEditable;
}

// The only stateful search component - owns the dialog open state, the
// Ctrl/Cmd+K shortcut, and a session id that forces SearchCommandContent to
// remount on every close. Remounting - rather than resetting individual
// pieces of state by hand - is what guarantees a debounced query can never
// leak into the next time the dialog opens: a freshly mounted component has
// no stale state to leak, by construction, and useDebouncedValue stays a
// plain, conventional debounce hook.
export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const navigate = useNavigate();
  const { workspaceId } = useActiveWorkspace();

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSessionId((id) => id + 1);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      // Only guard against hijacking focus when we'd be OPENING the palette
      // (typing in a task title, a comment box, ...). Once it's already
      // open, Radix's focus trap guarantees the only editable element that
      // can be focused is the palette's own CommandInput, and the shortcut
      // must still be able to close it from there.
      if (!open && isEditableElement(document.activeElement)) {
        return;
      }

      event.preventDefault();
      // Must go through handleOpenChange, not a bare setOpen - closing this
      // way still has to bump sessionId, or reopening via the same shortcut
      // (the most common way to close a command palette) skips the remount
      // that keeps stale query/debounce state from leaking into the next
      // session.
      handleOpenChange(!open);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleOpenChange]);

  function handleSelectProject(slug: string) {
    handleOpenChange(false);
    navigate(`/projects/${slug}`);
  }

  function handleSelectTask(taskId: string) {
    handleOpenChange(false);
    navigate(`/tasks/${taskId}`);
  }

  // Deep-links into the project's Sprints tab via router location state
  // rather than a URL/query param - ProjectWorkspacePage's tab selection is
  // (and stays) local component state, not URL-addressable, so this passes
  // an initial-tab hint the same way any other one-shot navigation intent
  // would. Consumed by ProjectWorkspacePage.
  function handleSelectSprint(projectSlug: string) {
    handleOpenChange(false);
    navigate(`/projects/${projectSlug}`, { state: { initialTab: "sprints" } });
  }

  // People results have no per-member page - Workspace Settings is where
  // the member list already lives (WorkspaceMembersCard), so this matches
  // the same "navigate to the page that already shows this" precedent as
  // project/task selection, not a new destination.
  function handleSelectMember() {
    handleOpenChange(false);
    navigate("/workspace/settings");
  }

  return (
    <>
      {/* Ctrl/Cmd+K requires a keyboard, so below `md` (no room for the wide
          bar, and the primary input method is touch) search needs its own
          reachable entry point - an icon button, matching how the other two
          header actions (notifications, create) are always visible rather
          than hidden below a breakpoint. */}
      <Button
        type="button"
        size="icon-lg"
        variant="secondary"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <SearchIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-80 justify-between rounded-lg border border-transparent bg-muted/40 px-3 text-muted-foreground transition-colors hover:border-border/40 hover:bg-muted/70 md:flex"
      >
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 opacity-70" />
          <span className="text-sm">Search...</span>
        </div>

        <kbd className="pointer-events-none rounded border border-border/30 bg-muted px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
          {shortcutLabel}
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search workspace"
        description="Find projects, tasks, sprints, and people by name."
        className="sm:max-w-lg"
      >
        <SearchCommandContent
          key={sessionId}
          workspaceId={workspaceId ?? undefined}
          onSelectProject={handleSelectProject}
          onSelectTask={handleSelectTask}
          onSelectSprint={handleSelectSprint}
          onSelectMember={handleSelectMember}
        />
      </CommandDialog>
    </>
  );
}
