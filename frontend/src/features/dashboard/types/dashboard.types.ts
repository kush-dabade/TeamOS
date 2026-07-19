import type { LucideIcon } from "lucide-react";

export interface WorkspaceHealthItem {
  id: string;
  label: string;
  state: string;
  tone: "healthy" | "warning" | "neutral";
  icon: LucideIcon;
}

export interface DashboardEvent {
  id: string;
  title: string;
  context: string;
  timestamp: string;
  tone: "default" | "success" | "warning";
  icon: LucideIcon;
}

export interface DashboardProject {
  id: string;
  name: string;

  completedTasks: number;
  totalTasks: number;

  status: string;
}
