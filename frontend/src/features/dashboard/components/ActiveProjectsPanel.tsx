import { DashboardPanel } from "./layout";
import { ProjectProgressRow } from "./active-projects";

import { mockProjects } from "../data/dashboard.mock";

export function ActiveProjectsPanel() {
  return (
    <DashboardPanel title="Active Projects" description="Projects currently in progress.">
      <div className="divide-border divide-y">
        {mockProjects.map((project) => (
          <ProjectProgressRow key={project.id} project={project} />
        ))}
      </div>
    </DashboardPanel>
  );
}
