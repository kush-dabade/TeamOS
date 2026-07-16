import type { ProjectListItem, ProjectWorkspaceTab } from "../../types";

interface WorkspaceContentProps {
  project: ProjectListItem;
  activeTab: ProjectWorkspaceTab;
}

const contentByTab: Record<ProjectWorkspaceTab, { title: string; description: string }> = {
  tasks: {
    title: "Tasks",
    description: "Tasks for this project will appear here.",
  },
  sprints: {
    title: "Sprints",
    description: "Sprints for this project will appear here.",
  },
  activity: {
    title: "Activity",
    description: "Project activity will appear here.",
  },
};

export function WorkspaceContent({ project, activeTab }: WorkspaceContentProps) {
  const content = contentByTab[activeTab];

  return (
    <section className="py-5" aria-label={`${content.title} for ${project.project.name}`}>
      <h2 className="text-sm font-medium">{content.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{content.description}</p>
    </section>
  );
}
