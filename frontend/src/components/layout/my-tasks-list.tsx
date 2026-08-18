import { Link } from "react-router-dom";

import {
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth";
import { useTasks } from "@/features/tasks";
import { useActiveWorkspace } from "@/features/workspaces";

import { MY_TASKS_PATH } from "./my-tasks-section";

const MAX_PREVIEW_TASKS = 5;
const skeletonRows = [0, 1, 2];

// Mounted only while MyTasksSection is expanded - reuses the exact same
// useTasks(workspaceId) hook TasksPage uses (features/tasks/hooks/use-tasks.ts),
// so results are shared/cached with the Tasks page instead of duplicating
// query logic, and the per-project fan-out it does internally only runs
// once the user actually opens this section.
export function MyTasksList() {
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const { tasks, isLoading, error } = useTasks(workspace?.id);

  const myTasks = user ? tasks.filter(({ assignee }) => assignee?.id === user.id) : [];
  const preview = myTasks.slice(0, MAX_PREVIEW_TASKS);

  return (
    <SidebarMenuSub>
      {isLoading ? (
        skeletonRows.map((row) => (
          <SidebarMenuSubItem key={row}>
            <SidebarMenuSkeleton />
          </SidebarMenuSubItem>
        ))
      ) : error ? (
        <SidebarMenuSubItem>
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Couldn&apos;t load tasks.</p>
        </SidebarMenuSubItem>
      ) : preview.length === 0 ? (
        <SidebarMenuSubItem>
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No tasks assigned</p>
        </SidebarMenuSubItem>
      ) : (
        preview.map(({ task }) => (
          <SidebarMenuSubItem key={task.id}>
            <SidebarMenuSubButton asChild>
              <Link to={`/tasks/${task.id}`}>
                <span className="truncate">{task.title}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))
      )}

      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild>
          <Link to={MY_TASKS_PATH}>
            <span className="truncate text-muted-foreground">View all</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  );
}
