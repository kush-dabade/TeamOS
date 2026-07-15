import type { DashboardProject } from "../../types";

interface ProjectProgressRowProps {
  project: DashboardProject;
  onClick?: () => void;
}

export function ProjectProgressRow({ project, onClick }: ProjectProgressRowProps) {
  const progress =
    project.totalTasks === 0 ? 0 : Math.round((project.completedTasks / project.totalTasks) * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group w-full
        rounded-md
        px-2.5 py-2.5
        text-left
        transition-colors duration-150
        hover:bg-muted/50
        focus-visible:outline-hidden
        focus-visible:ring-2
        focus-visible:ring-ring
      "
    >
      <h3
        className="
          truncate
          text-sm
          font-medium
          leading-5
          transition-colors
          group-hover:text-foreground
        "
      >
        {project.name}
      </h3>

      <div className="mt-2">
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        className="
          text-muted-foreground
          mt-2
          flex
          items-center
          text-xs
        "
      >
        <span className="truncate">{project.status}</span>

        <span className="mx-2 select-none">•</span>

        <span className="whitespace-nowrap">
          {project.completedTasks}/{project.totalTasks} tasks
        </span>

        <span className="ml-auto font-medium">{progress}%</span>
      </div>
    </button>
  );
}
