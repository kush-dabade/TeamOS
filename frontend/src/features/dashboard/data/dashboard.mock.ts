import type {
  DashboardEvent,
  DashboardProject,
  DashboardTask,
  WorkspaceHealthItem,
} from "../types";

import {
  Archive,
  CircleCheckBig,
  CircleAlert,
  FolderKanban,
  MessageSquare,
  Rocket,
  Users,
} from "lucide-react";

export const mockTasks: DashboardTask[] = [
  {
    id: "1",
    title: "Fix authentication bug",
    projectName: "Backend API",
    priority: "urgent",
    dueDate: "Due Today",
  },
  {
    id: "2",
    title: "Review dashboard architecture",
    projectName: "Frontend",
    priority: "high",
    dueDate: "Tomorrow",
  },
  {
    id: "3",
    title: "Design project page",
    projectName: "TeamOS",
    priority: "medium",
    dueDate: "Jul 16",
  },
  {
    id: "4",
    title: "Update landing page",
    projectName: "Website",
    priority: "low",
    dueDate: null,
  },
];

export const mockWorkspaceHealth: WorkspaceHealthItem[] = [
  {
    id: "projects",
    label: "Projects",
    state: "12 Active",
    tone: "healthy",
    icon: FolderKanban,
  },
  {
    id: "tasks",
    label: "Tasks",
    state: "2 Overdue",
    tone: "warning",
    icon: CircleAlert,
  },
  {
    id: "sprint",
    label: "Sprint",
    state: "On Track",
    tone: "healthy",
    icon: Rocket,
  },
  {
    id: "members",
    label: "Members",
    state: "8 Active",
    tone: "neutral",
    icon: Users,
  },
];

export const mockEvents: DashboardEvent[] = [
  {
    id: "1",
    title: "Authentication module completed",
    context: "Backend API",
    timestamp: "Just now",
    tone: "success",
    icon: CircleCheckBig,
  },
  {
    id: "2",
    title: "Sprint 14 started",
    context: "Website Redesign",
    timestamp: "18 min",
    tone: "default",
    icon: Rocket,
  },
  {
    id: "3",
    title: "API specification updated",
    context: "Backend API",
    timestamp: "1 hr",
    tone: "default",
    icon: MessageSquare,
  },
  {
    id: "4",
    title: "Website redesign archived",
    context: "Marketing Site",
    timestamp: "Yesterday",
    tone: "warning",
    icon: Archive,
  },
];

export const mockProjects: DashboardProject[] = [
  {
    id: "1",
    name: "Website Redesign",
    completedTasks: 12,
    totalTasks: 18,
    status: "Waiting for review",
  },
  {
    id: "2",
    name: "Authentication",
    completedTasks: 21,
    totalTasks: 23,
    status: "2 tasks remaining",
  },
  {
    id: "3",
    name: "Marketing Site",
    completedTasks: 5,
    totalTasks: 15,
    status: "Design phase",
  },
];
