import type { RouteObject } from "react-router-dom";

import { AuthenticatedRoute } from "@/features/auth";
import { ProfilePage } from "@/features/profile";
import { ProjectsPage, ProjectWorkspacePage } from "@/features/projects";
import { TasksPage, TaskWorkspacePage } from "@/features/tasks";
import {
  OnboardingPage,
  WorkspaceGuard,
  WorkspaceProvider,
  WorkspaceSettingsPage,
} from "@/features/workspaces";
import AppShell from "@/layouts/AppShell";
import RouteErrorBoundary from "@/layouts/RouteErrorBoundary";
import AppNotFoundPage from "@/pages/AppNotFoundPage";
import ForbiddenPage from "@/pages/ForbiddenPage";
import { DashboardPage } from "@/features/dashboard";

export const appRoutes: RouteObject[] = [
  {
    element: <AuthenticatedRoute />,
    errorElement: <RouteErrorBoundary fullPage />,
    children: [
      {
        path: "/onboarding",
        element: <OnboardingPage />,
      },
      {
        element: (
          <WorkspaceProvider>
            <WorkspaceGuard />
          </WorkspaceProvider>
        ),
        children: [
          {
            element: <AppShell />,
            children: [
              {
                errorElement: <RouteErrorBoundary />,
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
                  {
                    path: "/403",
                    element: <ForbiddenPage />,
                  },
                  {
                    path: "/not-found",
                    element: <AppNotFoundPage />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
