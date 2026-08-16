import { useRef } from "react";
import type { KeyboardEvent } from "react";

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
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // WAI-ARIA horizontal tabs pattern: only the active tab is in the tab
  // order, and Left/Right move both focus and selection with wraparound.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + tabs.length) % tabs.length;

    onTabChange(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <nav
      aria-label="Project workspace"
      className="sticky top-0 z-10 -mx-5 border-y bg-background/95 px-5 backdrop-blur"
    >
      <div className="overflow-x-auto">
        <div
          role="tablist"
          aria-label="Project workspace tabs"
          className="flex w-max items-center gap-1"
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`project-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`project-tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
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
