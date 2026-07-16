import type { ProjectWorkspaceTab } from "../../types";

interface ProjectNavigationProps {
  activeTab: ProjectWorkspaceTab;
  onTabChange: (tab: ProjectWorkspaceTab) => void;
}

const tabs: Array<{ id: ProjectWorkspaceTab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "sprints", label: "Sprints" },
  { id: "activity", label: "Activity" },
];

export function ProjectNavigation({ activeTab, onTabChange }: ProjectNavigationProps) {
  return (
    <nav
      aria-label="Project workspace"
      className="sticky top-0 z-10 -mx-5 border-y bg-background/95 px-5 backdrop-blur"
    >
      <div className="overflow-x-auto">
        <div className="flex w-max items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
