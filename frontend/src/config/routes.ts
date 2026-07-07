import { BriefcaseBusiness, Home, ListTodo, Milestone, type LucideIcon } from "lucide-react";

export interface AppRoute {
  path: string;
  title: string;
  navigationLabel: string;
  icon?: LucideIcon;
  showInSidebar: boolean;
}

export const appRoutesConfig: AppRoute[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    navigationLabel: "Home",
    icon: Home,
    showInSidebar: true,
  },
  {
    path: "/projects",
    title: "Projects",
    navigationLabel: "Projects",
    icon: BriefcaseBusiness,
    showInSidebar: true,
  },
  {
    path: "/tasks",
    title: "Tasks",
    navigationLabel: "Tasks",
    icon: ListTodo,
    showInSidebar: true,
  },
  {
    path: "/sprints",
    title: "Sprints",
    navigationLabel: "Sprints",
    icon: Milestone,
    showInSidebar: true,
  },
];
