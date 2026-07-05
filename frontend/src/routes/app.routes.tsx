import type { RouteObject } from "react-router-dom";

import { AuthenticatedRoute } from "@/features/auth";
import AppLayout from "@/layouts/AppLayout";
import DashboardPage from "@/pages/DashboardPage";

export const appRoutes: RouteObject[] = [
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        element: <AppLayout />,
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
