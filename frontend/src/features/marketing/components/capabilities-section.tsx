import { Activity, Bell, BriefcaseBusiness, CalendarRange, ListTodo, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="capabilities-heading"
          className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Everything a team needs to move work forward
        </h2>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="size-5 text-foreground" aria-hidden="true" />
              <CardTitle className="mt-3 text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
