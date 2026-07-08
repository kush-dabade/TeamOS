import type { RouteObject } from "react-router-dom";

import { AuthenticatedRoute } from "@/features/auth";
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
        ],
      },
    ],
  },
];
