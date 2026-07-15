import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";

import { ProjectProgressRow } from "./active-projects";
import { DashboardPanel } from "./layout";

import { mockProjects } from "../data/dashboard.mock";

export function ActiveProjectsPanel() {
  return (
    <DashboardPanel
      title="Projects"
      action={
        <Button
          variant="ghost"
          size="sm"
          className="
            h-6
            px-1.5
            text-xs
            font-medium
          "
        >
          View all
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      <div className="divide-y divide-border">
        {mockProjects.map((project) => (
          <ProjectProgressRow key={project.id} project={project} />
        ))}
      </div>
    </DashboardPanel>
  );
}
