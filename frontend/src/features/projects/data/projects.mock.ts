import type { ProjectListItem } from "../types";

export const mockProjects: ProjectListItem[] = [
  {
    project: {
      id: "project-website-redesign",
      slug: "website-redesign",
      name: "Website Redesign",
      description: "Refresh the marketing site and improve conversion paths.",
      status: "ACTIVE",
      createdAt: "2026-06-02T09:00:00.000Z",
      updatedAt: "2026-07-14T15:30:00.000Z",
    },
    completedTaskCount: 18,
    totalTaskCount: 27,
  },
  {
    project: {
      id: "project-authentication",
      slug: "authentication",
      name: "Authentication",
      description: "Establish secure account access and session management.",
      status: "ACTIVE",
      createdAt: "2026-05-18T10:15:00.000Z",
      updatedAt: "2026-07-12T11:45:00.000Z",
    },
    completedTaskCount: 21,
    totalTaskCount: 23,
  },
  {
    project: {
      id: "project-mobile-launch",
      slug: "mobile-launch",
      name: "Mobile Launch",
      description: "Prepare the initial mobile application release.",
      status: "PLANNED",
      createdAt: "2026-07-01T08:30:00.000Z",
      updatedAt: "2026-07-10T14:20:00.000Z",
    },
    completedTaskCount: 0,
    totalTaskCount: 12,
  },
  {
    project: {
      id: "project-design-system",
      slug: "design-system",
      name: "Design System",
      description: null,
      status: "COMPLETED",
      createdAt: "2026-03-11T13:00:00.000Z",
      updatedAt: "2026-06-28T16:10:00.000Z",
    },
    completedTaskCount: 15,
    totalTaskCount: 15,
  },
  {
    project: {
      id: "project-legacy-api",
      slug: "legacy-api",
      name: "Legacy API",
      description: "Retired API migration work retained for historical reference.",
      status: "ARCHIVED",
      createdAt: "2026-01-20T09:30:00.000Z",
      updatedAt: "2026-04-08T12:00:00.000Z",
    },
    completedTaskCount: 9,
    totalTaskCount: 10,
  },
];
