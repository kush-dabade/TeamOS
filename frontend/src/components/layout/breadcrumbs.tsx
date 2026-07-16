import { ChevronRight } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useCurrentRoute } from "@/hooks";

export function Breadcrumbs() {
  const route = useCurrentRoute();
  const { pathname } = useLocation();
  const { slug } = useParams();
  const isProjectWorkspace = slug && pathname.startsWith(`/projects/${slug}`);

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
      ) : (
        <span className="font-medium">{route?.title ?? "TeamOS"}</span>
      )}
    </nav>
  );
}

function formatProjectName(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
