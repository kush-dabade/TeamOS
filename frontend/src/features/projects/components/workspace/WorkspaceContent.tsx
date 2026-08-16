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
      <section
        id="project-tabpanel-activity"
        role="tabpanel"
        aria-label={`Activity for ${project.project.name}`}
        className="py-5"
      >
        <h2 className="text-sm font-medium">Activity</h2>
        <div className="mt-3">
          <ProjectActivity workspaceId={workspaceId} projectId={project.project.id} />
        </div>
      </section>
    );
  }

  if (activeTab === "sprints") {
    return (
      <section
        id="project-tabpanel-sprints"
        role="tabpanel"
        aria-label={`Sprints for ${project.project.name}`}
        className="py-5"
      >
        <ProjectSprints projectId={project.project.id} />
      </section>
    );
  }

  return (
    <section
      id="project-tabpanel-tasks"
      role="tabpanel"
      aria-label={`Tasks for ${project.project.name}`}
      className="py-5"
    >
      <ProjectTasks project={project.project} workspaceId={workspaceId} />
    </section>
  );
}
