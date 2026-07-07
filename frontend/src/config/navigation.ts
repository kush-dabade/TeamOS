import { Milestone, BriefcaseBusiness, Home, ListTodo, type LucideIcon } from "lucide-react";

export interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const appNavigation: NavigationItem[] = [
  {
    label: "Home",
    to: "/dashboard",
    icon: Home,
  },
  {
    label: "Projects",
    to: "/projects",
    icon: BriefcaseBusiness,
  },
  {
    label: "Tasks",
    to: "/tasks",
    icon: ListTodo,
  },
  {
    label: "Sprints",
    to: "/sprints",
    icon: Milestone,
  },
];
