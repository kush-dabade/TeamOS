import type { TaskListItem } from "@/features/tasks/types";

import type { ContinueWorkingItem, DashboardEvent, WorkspaceAttentionItem } from "../types";

import { Archive, CircleCheckBig, MessageSquare, Rocket } from "lucide-react";

// Actionable items requiring attention. MVP is task-based only (overdue and
// pending-review); sprint- and notification-sourced kinds arrive once those
// modules ship. Ordered most-severe first — the panel slices to its cap without
// re-sorting, so ordering here is representative of the eventual TM-08 query.
export const mockWorkspaceAttention: WorkspaceAttentionItem[] = [
  {
    id: "attention-auth-session-expiry",
    kind: "OVERDUE_TASK",
    title: "Handle expired session recovery",
    context: "Authentication",
    occurredAt: "2026-07-16T00:00:00.000Z",
    entityType: "TASK",
    entityId: "task-auth-session-expiry",
  },
  {
    id: "attention-api-rate-limiting",
    kind: "OVERDUE_TASK",
    title: "Finalize API rate limiting",
    context: "Backend API",
    occurredAt: "2026-07-17T00:00:00.000Z",
    entityType: "TASK",
    entityId: "task-api-rate-limiting",
  },
  {
    id: "attention-billing-webhooks",
    kind: "OVERDUE_TASK",
    title: "Verify billing webhook retries",
    context: "Payments",
    occurredAt: "2026-07-18T00:00:00.000Z",
    entityType: "TASK",
    entityId: "task-billing-webhooks",
  },
  {
    id: "attention-homepage-audit",
    kind: "PENDING_REVIEW",
    title: "Audit homepage conversion path",
    context: "Website Redesign",
    occurredAt: "2026-07-18T14:20:00.000Z",
    entityType: "TASK",
    entityId: "task-website-homepage-audit",
  },
  {
    id: "attention-notification-service",
    kind: "PENDING_REVIEW",
    title: "Refactor notification service",
    context: "Backend API",
    occurredAt: "2026-07-17T09:10:00.000Z",
    entityType: "TASK",
    entityId: "task-refactor-notifications",
  },
  {
    id: "attention-onboarding-checklist",
    kind: "PENDING_REVIEW",
    title: "Update onboarding checklist",
    context: "Mobile Launch",
    occurredAt: "2026-07-16T11:30:00.000Z",
    entityType: "TASK",
    entityId: "task-onboarding-checklist",
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

// Projects the current user was recently working in, most-recent-first.
// `lastActivityAt` (project `updatedAt`) is the MVP proxy for recency; the panel
// slices to its cap without re-sorting, so ordering here is representative of
// the eventual query.
export const mockContinueWorking: ContinueWorkingItem[] = [
  {
    id: "project-website-redesign",
    slug: "website-redesign",
    name: "Website Redesign",
    status: "ACTIVE",
    lastActivityAt: "2026-07-19T09:12:00.000Z",
  },
  {
    id: "project-authentication",
    slug: "authentication",
    name: "Authentication",
    status: "ACTIVE",
    lastActivityAt: "2026-07-18T16:40:00.000Z",
  },
  {
    id: "project-team-os",
    slug: "team-os",
    name: "TeamOS",
    status: "ACTIVE",
    lastActivityAt: "2026-07-18T11:05:00.000Z",
  },
  {
    id: "project-mobile-launch",
    slug: "mobile-launch",
    name: "Mobile Launch",
    status: "PLANNED",
    lastActivityAt: "2026-07-17T14:30:00.000Z",
  },
  {
    id: "project-marketing-site",
    slug: "marketing-site",
    name: "Marketing Site",
    status: "ACTIVE",
    lastActivityAt: "2026-07-16T10:20:00.000Z",
  },
  {
    id: "project-billing",
    slug: "billing",
    name: "Billing & Payments",
    status: "COMPLETED",
    lastActivityAt: "2026-07-15T08:00:00.000Z",
  },
];

// Tasks assigned to the current user, shaped as the Tasks domain model so the
// `useMyTasks` boundary can later map an API response without changing consumers.
const currentUser = { id: "user-current", name: "You" };

export const mockMyTasks: TaskListItem[] = [
  {
    task: {
      id: "task-auth-session-expiry",
      workspaceId: "workspace-team-os",
      projectId: "project-authentication",
      title: "Handle expired session recovery",
      description: "Provide a clear re-authentication path when a session expires.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: "2026-07-16T00:00:00.000Z",
      createdById: "user-marcus-chen",
      assigneeId: currentUser.id,
      completedAt: null,
      deletedAt: null,
      sprintId: null,
      createdAt: "2026-07-03T11:30:00.000Z",
      updatedAt: "2026-07-17T10:05:00.000Z",
    },
    assignee: currentUser,
    project: { id: "project-authentication", slug: "authentication", name: "Authentication" },
  },
  {
    task: {
      id: "task-website-homepage-audit",
      workspaceId: "workspace-team-os",
      projectId: "project-website-redesign",
      title: "Audit homepage conversion path",
      description: "Document the highest-impact improvements to the homepage journey.",
      status: "REVIEW",
      priority: "HIGH",
      dueDate: "2026-07-19T00:00:00.000Z",
      createdById: "user-sarah-johnson",
      assigneeId: currentUser.id,
      completedAt: null,
      deletedAt: null,
      sprintId: null,
      createdAt: "2026-07-08T09:15:00.000Z",
      updatedAt: "2026-07-18T14:20:00.000Z",
    },
    assignee: currentUser,
    project: { id: "project-website-redesign", slug: "website-redesign", name: "Website Redesign" },
  },
  {
    task: {
      id: "task-dashboard-my-tasks",
      workspaceId: "workspace-team-os",
      projectId: "project-team-os",
      title: "Ship the My Tasks dashboard panel",
      description: "Turn the placeholder hero panel into the primary task surface.",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: "2026-07-24T00:00:00.000Z",
      createdById: "user-current",
      assigneeId: currentUser.id,
      completedAt: null,
      deletedAt: null,
      sprintId: null,
      createdAt: "2026-07-15T08:00:00.000Z",
      updatedAt: "2026-07-18T16:45:00.000Z",
    },
    assignee: currentUser,
    project: { id: "project-team-os", slug: "team-os", name: "TeamOS" },
  },
  {
    task: {
      id: "task-marketing-copy-review",
      workspaceId: "workspace-team-os",
      projectId: "project-marketing-site",
      title: "Review launch announcement copy",
      description: "Sign off on the marketing site launch messaging.",
      status: "TODO",
      priority: "LOW",
      dueDate: null,
      createdById: "user-jordan-lee",
      assigneeId: currentUser.id,
      completedAt: null,
      deletedAt: null,
      sprintId: null,
      createdAt: "2026-07-12T13:10:00.000Z",
      updatedAt: "2026-07-16T09:30:00.000Z",
    },
    assignee: currentUser,
    project: { id: "project-marketing-site", slug: "marketing-site", name: "Marketing Site" },
  },
  {
    task: {
      id: "task-mobile-onboarding-flow",
      workspaceId: "workspace-team-os",
      projectId: "project-mobile-launch",
      title: "Define mobile onboarding flow",
      description: "Map the initial account setup experience for the mobile launch.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-07-28T00:00:00.000Z",
      createdById: "user-priya-patel",
      assigneeId: currentUser.id,
      completedAt: null,
      deletedAt: null,
      sprintId: null,
      createdAt: "2026-07-10T15:45:00.000Z",
      updatedAt: "2026-07-17T12:00:00.000Z",
    },
    assignee: currentUser,
    project: { id: "project-mobile-launch", slug: "mobile-launch", name: "Mobile Launch" },
  },
];
