import type { RouteObject } from "react-router-dom";

import AppLayout from "@/layouts/AppLayout";
import DashboardPage from "@/pages/DashboardPage";

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
    ],
  },
];
