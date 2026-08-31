import { Activity, Bell, BriefcaseBusiness, CalendarRange, ListTodo, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Capability {
  icon: LucideIcon;
  title: string;
  description: string;
}

const capabilities: Capability[] = [
  {
    icon: BriefcaseBusiness,
    title: "Projects",
    description: "Organize work into projects with status, ownership, and progress tracking.",
  },
  {
    icon: ListTodo,
    title: "Tasks",
    description: "Track status, priority, assignees, and due dates on every task.",
  },
  {
    icon: CalendarRange,
    title: "Sprints",
    description: "Plan focused sprints and move tasks through them as work progresses.",
  },
  {
    icon: Activity,
    title: "Activity feed",
    description: "Every change is recorded, so a project's history is always visible.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Stay on top of assignments and updates as they happen.",
  },
  {
    icon: Search,
    title: "Search",
    description: "Find projects, tasks, and comments across the workspace instantly.",
  },
];

const CAPABILITY_COLUMNS = 2;

// Grouped into rows so a rule can separate rows without also cutting
// between the two columns of the same row (see sm:divide-y-0 below).
const capabilityRows: Capability[][] = Array.from(
  { length: Math.ceil(capabilities.length / CAPABILITY_COLUMNS) },
  (_, rowIndex) =>
    capabilities.slice(rowIndex * CAPABILITY_COLUMNS, rowIndex * CAPABILITY_COLUMNS + CAPABILITY_COLUMNS),
);

export function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl border-t border-border pt-6">
        <p className="text-sm font-medium text-muted-foreground">Capabilities</p>

        <h2
          id="capabilities-heading"
          className="mt-4 max-w-2xl font-heading text-2xl font-medium tracking-tight text-balance sm:text-3xl"
        >
          Everything a team needs to move work forward
        </h2>
      </div>

      <div className="mx-auto mt-16 max-w-6xl">
        {capabilityRows.map((row) => (
          <div
            key={row.map(({ title }) => title).join("-")}
            className="grid gap-x-12 divide-y divide-border border-t border-border first:border-t-0 sm:grid-cols-2 sm:divide-y-0"
          >
            {row.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3 py-8">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                <div>
                  <h3 className="font-heading text-base font-medium text-foreground">{title}</h3>
                  <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
