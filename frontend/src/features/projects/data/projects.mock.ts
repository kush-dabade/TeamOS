import type { Project } from "../types";

export const mockProjects: Project[] = [
  {
    id: "project-website-redesign",
    slug: "website-redesign",
    name: "Website Redesign",
    description: "Refresh the marketing site and improve conversion paths.",
    status: "ACTIVE",
    createdAt: "2026-06-02T09:00:00.000Z",
    updatedAt: "2026-07-14T15:30:00.000Z",
  },
  {
    id: "project-authentication",
    slug: "authentication",
    name: "Authentication",
    description: "Establish secure account access and session management.",
    status: "ACTIVE",
    createdAt: "2026-05-18T10:15:00.000Z",
    updatedAt: "2026-07-12T11:45:00.000Z",
  },
  {
    id: "project-mobile-launch",
    slug: "mobile-launch",
    name: "Mobile Launch",
    description: "Prepare the initial mobile application release.",
    status: "PLANNED",
    createdAt: "2026-07-01T08:30:00.000Z",
    updatedAt: "2026-07-10T14:20:00.000Z",
  },
  {
    id: "project-design-system",
    slug: "design-system",
    name: "Design System",
    description: null,
    status: "COMPLETED",
    createdAt: "2026-03-11T13:00:00.000Z",
    updatedAt: "2026-06-28T16:10:00.000Z",
  },
];
