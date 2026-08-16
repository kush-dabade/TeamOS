import { ProjectActivity } from "./ProjectActivity";
import { ProjectSprints } from "./ProjectSprints";
import { ProjectTasks } from "./ProjectTasks";

import type { ProjectListItem, ProjectWorkspaceTab } from "../../types";

interface WorkspaceContentProps {
  project: ProjectListItem;
  workspaceId: string;
  activeTab: ProjectWorkspaceTab;
}

export function WorkspaceContent({ project, workspaceId, activeTab }: WorkspaceContentProps) {
  if (activeTab === "activity") {
    return (
      <section className="py-5" aria-label={`Activity for ${project.project.name}`}>
        <h2 className="text-sm font-medium">Activity</h2>
        <div className="mt-3">
          <ProjectActivity workspaceId={workspaceId} projectId={project.project.id} />
        </div>
      </section>
    );
  }

  if (activeTab === "sprints") {
    return (
      <section className="py-5" aria-label={`Sprints for ${project.project.name}`}>
        <ProjectSprints projectId={project.project.id} />
      </section>
    );
  }

  return (
    <section className="py-5" aria-label={`Tasks for ${project.project.name}`}>
      <ProjectTasks project={project.project} workspaceId={workspaceId} />
    </section>
  );
}
