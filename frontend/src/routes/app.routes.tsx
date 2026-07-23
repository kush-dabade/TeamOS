import type { RouteObject } from "react-router-dom";

import { AuthenticatedRoute } from "@/features/auth";
import { ProfilePage } from "@/features/profile";
import { ProjectsPage, ProjectWorkspacePage } from "@/features/projects";
import { TasksPage, TaskWorkspacePage } from "@/features/tasks";
import { OnboardingPage, WorkspaceGuard, WorkspaceSettingsPage } from "@/features/workspaces";
import AppShell from "@/layouts/AppShell";
import { DashboardPage } from "@/features/dashboard";

export const appRoutes: RouteObject[] = [
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        path: "/onboarding",
        element: <OnboardingPage />,
      },
      {
        element: <WorkspaceGuard />,
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
              {
                path: "/profile",
                element: <ProfilePage />,
              },
              {
                path: "/workspace/settings",
                element: <WorkspaceSettingsPage />,
              },
            ],
          },
        ],
      },
    ],
  },
];
