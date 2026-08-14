import type { RouteObject } from "react-router-dom";

import { GuestRoute } from "@/features/auth";
import { InvitationPage } from "@/features/invitations";
import PublicLayout from "@/layouts/PublicLayout";
import RouteErrorBoundary from "@/layouts/RouteErrorBoundary";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";

import { NotFoundGate } from "./not-found-gate";

export const publicRoutes: RouteObject[] = [
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary fullPage recoveryPath="/" recoveryLabel="Back to home" />,
  },
  {
    path: "/invitations/:token",
    element: <InvitationPage />,
    errorElement: <RouteErrorBoundary fullPage recoveryPath="/" recoveryLabel="Back to home" />,
  },
  {
    // Public regardless of auth state, like /invitations/:token above:
    // Better Auth's verification link redirects here with no session, but
    // an already-authenticated user could also land here (e.g. clicking an
    // old email while still signed in) - it must render the result either
    // way rather than bouncing through GuestRoute/AuthenticatedRoute.
    path: "/verify-email",
    element: <VerifyEmailPage />,
    errorElement: <RouteErrorBoundary fullPage recoveryPath="/" recoveryLabel="Back to home" />,
  },
  {
    path: "*",
    element: <NotFoundGate />,
  },
  {
    element: <GuestRoute />,
    errorElement: <RouteErrorBoundary fullPage recoveryPath="/" recoveryLabel="Back to home" />,
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
