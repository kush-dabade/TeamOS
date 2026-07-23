import type { RouteObject } from "react-router-dom";

import { GuestRoute } from "@/features/auth";
import PublicLayout from "@/layouts/PublicLayout";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

import { NotFoundGate } from "./not-found-gate";

export const publicRoutes: RouteObject[] = [
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "*",
    element: <NotFoundGate />,
  },
  {
    element: <GuestRoute />,
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
