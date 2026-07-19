import type { LucideIcon } from "lucide-react";

export type AttentionItemKind = "OVERDUE_TASK" | "PENDING_REVIEW";

export type AttentionEntityType = "TASK";

export interface WorkspaceAttentionItem {
  id: string;
  kind: AttentionItemKind;
  title: string;
  context: string;
  occurredAt: string;
  entityType: AttentionEntityType;
  entityId: string;
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
