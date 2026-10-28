import { ChevronRight } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useProjects } from "@/features/projects";
import { useTask } from "@/features/tasks";
import { useActiveWorkspace } from "@/features/workspaces";
import { useCurrentRoute } from "@/hooks";

export function Breadcrumbs() {
  const route = useCurrentRoute();
  const { pathname } = useLocation();
  const { slug, taskId } = useParams();
  const isProjectWorkspace = slug && pathname.startsWith(`/projects/${slug}`);
  const isTaskWorkspace = taskId && pathname.startsWith(`/tasks/${taskId}`);
  const taskQuery = useTask(isTaskWorkspace ? taskId : undefined);
  const taskTitle = isTaskWorkspace ? (taskQuery.data?.taskItem.task.title ?? "Task") : null;
  const projectName = useProjectName(isProjectWorkspace ? slug : undefined);

  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center text-sm">
      {isProjectWorkspace ? (
        <>
          <Link to="/projects" className="font-medium hover:text-foreground">
            Projects
          </Link>
          <ChevronRight className="mx-1 size-3.5" aria-hidden="true" />
          <span className="max-w-48 truncate font-medium text-foreground">
            {projectName}
          </span>
        </>
      ) : isTaskWorkspace ? (
        <>
          <Link to="/tasks" className="font-medium hover:text-foreground">
            Tasks
          </Link>
          <ChevronRight className="mx-1 size-3.5" aria-hidden="true" />
          <span className="max-w-48 truncate font-medium text-foreground">{taskTitle}</span>
        </>
      ) : (
        <span className="font-medium">{route?.title ?? "TeamOS"}</span>
      )}
    </nav>
  );
}

// The project's current name, from the same cached list queries
// ProjectWorkspacePage resolves the slug with (active list first, archived
// list only if not found there), so no extra request is made. The slug is
// fixed at creation and goes stale after a rename, so it's only a stand-in
// while the lists load.
function useProjectName(slug: string | undefined): string {
  const { workspace } = useActiveWorkspace();
  const workspaceId = slug ? workspace?.id : undefined;
  const projectsQuery = useProjects(workspaceId);
  const activeMatch = projectsQuery.data?.find(({ project }) => project.slug === slug);
  const archivedQuery = useProjects(
    projectsQuery.isSuccess && !activeMatch ? workspaceId : undefined,
    "ARCHIVED",
  );
  const archivedMatch = archivedQuery.data?.find(({ project }) => project.slug === slug);

  return (activeMatch ?? archivedMatch)?.project.name ?? formatProjectName(slug ?? "");
}

function formatProjectName(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
