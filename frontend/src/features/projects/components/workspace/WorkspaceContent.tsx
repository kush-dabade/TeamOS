import { ProjectActivity } from "./ProjectActivity";
import { ProjectSprints } from "./ProjectSprints";

import type { ProjectListItem, ProjectWorkspaceTab } from "../../types";

interface WorkspaceContentProps {
  project: ProjectListItem;
  workspaceId: string;
  activeTab: ProjectWorkspaceTab;
}

const placeholderContentByTab: Record<
  Exclude<ProjectWorkspaceTab, "activity" | "sprints">,
  { title: string; description: string }
> = {
  tasks: {
    title: "Tasks",
    description: "Tasks for this project will appear here.",
  },
};

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

  const content = placeholderContentByTab[activeTab];

  return (
    <section className="py-5" aria-label={`${content.title} for ${project.project.name}`}>
      <h2 className="text-sm font-medium">{content.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{content.description}</p>
    </section>
  );
}
