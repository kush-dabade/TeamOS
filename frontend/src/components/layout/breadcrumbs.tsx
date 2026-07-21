import { ChevronRight } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useTask } from "@/features/tasks";
import { useCurrentRoute } from "@/hooks";

export function Breadcrumbs() {
  const route = useCurrentRoute();
  const { pathname } = useLocation();
  const { slug, taskId } = useParams();
  const isProjectWorkspace = slug && pathname.startsWith(`/projects/${slug}`);
  const isTaskWorkspace = taskId && pathname.startsWith(`/tasks/${taskId}`);
  const taskQuery = useTask(isTaskWorkspace ? taskId : undefined);
  const taskTitle = isTaskWorkspace ? (taskQuery.data?.taskItem.task.title ?? "Task") : null;

  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center text-sm">
      {isProjectWorkspace ? (
        <>
          <Link to="/projects" className="font-medium hover:text-foreground">
            Projects
          </Link>
          <ChevronRight className="mx-1 size-3.5" aria-hidden="true" />
          <span className="max-w-48 truncate font-medium text-foreground">
            {formatProjectName(slug)}
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

function formatProjectName(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
