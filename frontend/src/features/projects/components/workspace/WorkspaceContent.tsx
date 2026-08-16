import { ProjectActivity } from "./ProjectActivity";
import { ProjectSprints } from "./ProjectSprints";
import { ProjectTasks } from "./ProjectTasks";

import type { ProjectListItem, ProjectWorkspaceTab } from "../../types";

interface WorkspaceContentProps {
  project: ProjectListItem;
  workspaceId: string;
  activeTab: ProjectWorkspaceTab;
}

// All three tabpanel shells stay mounted (hidden, not unmounted) so the
// aria-controls targets set by ProjectNavigation always resolve to real
// elements. Only the active tab's feature content actually renders, so
// switching tabs doesn't keep expensive queries/subscriptions alive for
// panels the user isn't looking at.
export function WorkspaceContent({ project, workspaceId, activeTab }: WorkspaceContentProps) {
  return (
    <>
      <section
        id="project-tabpanel-tasks"
        role="tabpanel"
        aria-labelledby="project-tab-tasks"
        hidden={activeTab !== "tasks"}
        className="py-5"
      >
        {activeTab === "tasks" ? (
          <ProjectTasks project={project.project} workspaceId={workspaceId} />
        ) : null}
      </section>

      <section
        id="project-tabpanel-sprints"
        role="tabpanel"
        aria-labelledby="project-tab-sprints"
        hidden={activeTab !== "sprints"}
        className="py-5"
      >
        {activeTab === "sprints" ? <ProjectSprints projectId={project.project.id} /> : null}
      </section>

      <section
        id="project-tabpanel-activity"
        role="tabpanel"
        aria-labelledby="project-tab-activity"
        hidden={activeTab !== "activity"}
        className="py-5"
      >
        {activeTab === "activity" ? (
          <>
            <h2 className="text-sm font-medium">Activity</h2>
            <div className="mt-3">
              <ProjectActivity workspaceId={workspaceId} projectId={project.project.id} />
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
