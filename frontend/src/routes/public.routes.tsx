import type { RouteObject } from "react-router-dom";

import { GuestRoute } from "@/features/auth";
import { InvitationPage } from "@/features/invitations";
import PublicLayout from "@/layouts/PublicLayout";
import RouteErrorBoundary from "@/layouts/RouteErrorBoundary";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

import { NotFoundGate } from "./not-found-gate";

export const publicRoutes: RouteObject[] = [
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary fullPage />,
  },
  {
    path: "/invitations/:token",
    element: <InvitationPage />,
    errorElement: <RouteErrorBoundary fullPage />,
  },
  {
    path: "*",
    element: <NotFoundGate />,
  },
  {
    element: <GuestRoute />,
    errorElement: <RouteErrorBoundary fullPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            path: "/login",
            element: <LoginPage />,
          },
          {
            path: "/register",
            element: <RegisterPage />,
          },
        ],
      },
    ],
  },
];
