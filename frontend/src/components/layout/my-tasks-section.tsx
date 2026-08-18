import { useState } from "react";
import { ChevronRight, ListChecks } from "lucide-react";
import { useLocation } from "react-router-dom";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/utils";

import { MyTasksList } from "./my-tasks-list";

export const MY_TASKS_PATH = "/tasks?assignee=me";

// Expand/collapse only - deliberately not a Link. MyTasksList (the part
// that actually calls useTasks) only ever mounts once the section has been
// opened at least once, so the per-project task fan-out (see use-tasks.ts)
// is paid once the user opts in, not on every page load from the
// always-mounted sidebar. It then stays mounted (just hidden) across later
// collapses so re-expanding is instant/cached instead of re-fetching and
// popping in empty every time.
export function MyTasksSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const location = useLocation();

  const isViewAllActive =
    location.pathname === "/tasks" && new URLSearchParams(location.search).get("assignee") === "me";

  const handleToggle = () => {
    setIsExpanded((expanded) => !expanded);
    setHasOpened(true);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={isViewAllActive}
        aria-expanded={isExpanded}
        onClick={handleToggle}
      >
        <ListChecks className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">My Tasks</span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-200 ease-out",
            isExpanded && "rotate-90",
          )}
          aria-hidden="true"
        />
      </SidebarMenuButton>

      {/* Same grid-rows collapse trick as CommentItem's delete animation -
          animates to/from the content's real height without measuring it. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">{hasOpened ? <MyTasksList /> : null}</div>
      </div>
    </SidebarMenuItem>
  );
}
