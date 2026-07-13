import type {
  DashboardActivity,
  DashboardProject,
  DashboardTask,
  WorkspaceSnapshot,
} from "../types";

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

export const mockWorkspaceSnapshot: WorkspaceSnapshot = {
  projectCount: 12,
  taskCount: 84,
  memberCount: 8,
  activeSprint: true,
};

export const mockActivities: DashboardActivity[] = [
  {
    id: "1",
    message: "You completed Authentication module",
    timestamp: "2 minutes ago",
  },
  {
    id: "2",
    message: "Sarah created Sprint 14",
    timestamp: "18 minutes ago",
  },
  {
    id: "3",
    message: "Alex commented on API Specification",
    timestamp: "1 hour ago",
  },
  {
    id: "4",
    message: "Website Redesign project was updated",
    timestamp: "Yesterday",
  },
];

export const mockProjects: DashboardProject[] = [
  {
    id: "1",
    name: "Website Redesign",
    completedTasks: 12,
    totalTasks: 18,
  },
  {
    id: "2",
    name: "Authentication",
    completedTasks: 21,
    totalTasks: 23,
  },
  {
    id: "3",
    name: "Marketing Site",
    completedTasks: 5,
    totalTasks: 15,
  },
];
