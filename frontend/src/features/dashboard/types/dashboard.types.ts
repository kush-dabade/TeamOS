export type DashboardTaskPriority = "low" | "medium" | "high" | "urgent";

export interface DashboardTask {
  id: string;
  title: string;
  projectName: string;
  priority: DashboardTaskPriority;
  dueDate: string | null;
}

export interface DashboardActivity {
  id: string;
  message: string;
  timestamp: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  completedTasks: number;
  totalTasks: number;
}

export interface WorkspaceSnapshot {
  projectCount: number;
  taskCount: number;
  memberCount: number;
  activeSprint: boolean;
}
