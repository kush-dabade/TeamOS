import type { DashboardProject } from "../../types";

interface ProjectProgressRowProps {
  project: DashboardProject;
  onClick?: () => void;
}

export function ProjectProgressRow({ project, onClick }: ProjectProgressRowProps) {
  const progress =
    project.totalTasks > 0 ? Math.round((project.completedTasks / project.totalTasks) * 100) : 0;
    
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h3 className="text-sm font-medium transition-colors group-hover:text-foreground">
        {project.name}
      </h3>

      <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <span>
          {project.completedTasks} / {project.totalTasks} tasks
        </span>

        <span>{progress}% complete</span>
      </div>
    </button>
  );
}
