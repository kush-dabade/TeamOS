import { ProjectStatusBadge } from "@/features/projects/components/ProjectStatusBadge";

import { showcaseProjects } from "./showcase-data";

export function ShowcaseProjectList() {
  return (
    <ul className="space-y-1">
      {showcaseProjects.map((project) => (
        <li
          key={project.id}
          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
        >
          <span className="truncate text-sm font-medium">{project.name}</span>
          <ProjectStatusBadge status={project.status} />
        </li>
      ))}
    </ul>
  );
}
