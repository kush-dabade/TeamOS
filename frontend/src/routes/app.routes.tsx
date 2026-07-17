import type { RouteObject } from "react-router-dom";

import { AuthenticatedRoute } from "@/features/auth";
import { ProjectsPage, ProjectWorkspacePage } from "@/features/projects";
import { TasksPage, TaskWorkspacePage } from "@/features/tasks";
import AppShell from "@/layouts/AppShell";
import { DashboardPage } from "@/features/dashboard";

export const appRoutes: RouteObject[] = [
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardPage />,
          },
          {
            path: "/projects",
            element: <ProjectsPage />,
          },
          {
            path: "/projects/:slug",
            element: <ProjectWorkspacePage />,
          },
          {
            path: "/tasks",
            element: <TasksPage />,
          },
          {
            path: "/tasks/:taskId",
            element: <TaskWorkspacePage />,
          },
        ],
      },
    ],
  },
];
