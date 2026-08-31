import type { Activity } from "@/features/activity";
import type { ProjectStatus } from "@/features/projects";
import type { SprintStatus } from "@/features/sprints";
import type { TaskPriority, TaskStatus } from "@/features/tasks";

/**
 * Static, representative content for the landing page's read-only product
 * showcase. Never fetched — the marketing page makes no API calls and
 * requires no session, so this is deliberately separate from (and not
 * derived from) backend/prisma/seed.ts's local-dev seed data.
 */

export interface ShowcaseProject {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface ShowcaseTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: { name: string } | null;
}

export const showcaseProjects: ShowcaseProject[] = [
  { id: "p1", name: "Website Redesign", status: "ACTIVE" },
  { id: "p2", name: "Mobile App", status: "PLANNED" },
  { id: "p3", name: "Q1 Roadmap", status: "ACTIVE" },
];

export const showcaseSprint: { name: string; status: SprintStatus } = {
  name: "Sprint 4 — Homepage Launch",
  status: "ACTIVE",
};

export const showcaseTasks: ShowcaseTask[] = [
  {
    id: "t1",
    title: "Design new homepage layout",
    status: "DONE",
    priority: "HIGH",
    assignee: { name: "Maya Chen" },
  },
  {
    id: "t2",
    title: "Implement responsive navigation",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignee: { name: "Jordan Lee" },
  },
  {
    id: "t3",
    title: "QA cross-browser testing",
    status: "REVIEW",
    priority: "MEDIUM",
    assignee: { name: "Sam Patel" },
  },
  {
    id: "t4",
    title: "Write onboarding docs",
    status: "TODO",
    priority: "LOW",
    assignee: null,
  },
];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// Computed once at module load (page load), not re-derived per render —
// relative timestamps ("2h ago") stay stable for the life of the page visit.
const now = Date.now();

export const showcaseActivities: Activity[] = [
  {
    id: "a1",
    type: "TASK_COMPLETED",
    entityType: "TASK",
    entityId: "t1",
    taskId: "t1",
    projectId: "p1",
    metadata: { taskTitle: "Design new homepage layout" },
    actor: { id: "u1", name: "Maya Chen", image: null },
    createdAt: new Date(now - 2 * HOUR_MS).toISOString(),
  },
  {
    id: "a2",
    type: "TASK_STATUS_CHANGED",
    entityType: "TASK",
    entityId: "t2",
    taskId: "t2",
    projectId: "p1",
    metadata: { taskTitle: "Implement responsive navigation" },
    actor: { id: "u2", name: "Jordan Lee", image: null },
    createdAt: new Date(now - 40 * MINUTE_MS).toISOString(),
  },
  {
    id: "a3",
    type: "COMMENT_CREATED",
    entityType: "COMMENT",
    entityId: "c1",
    taskId: "t3",
    projectId: "p1",
    metadata: { taskTitle: "QA cross-browser testing" },
    actor: { id: "u3", name: "Sam Patel", image: null },
    createdAt: new Date(now - 24 * HOUR_MS).toISOString(),
  },
];
