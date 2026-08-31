import type { RouteObject } from "react-router-dom";

import { GuestRoute } from "@/features/auth";
import { TryPage } from "@/features/demo";
import { InvitationPage } from "@/features/invitations";
import PublicLayout from "@/layouts/PublicLayout";
import RouteErrorBoundary from "@/layouts/RouteErrorBoundary";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";

import { NotFoundGate } from "./not-found-gate";

export const publicRoutes: RouteObject[] = [
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary fullPage recoveryPath="/" recoveryLabel="Back to home" />,
  },
  {
    // Deliberately not wrapped in GuestRoute/AuthenticatedRoute/
    // WorkspaceGuard - the whole point of this route is to create the
    // session that lets a visitor enter the authenticated app in the first
    // place. TryPage itself checks useAuth() and redirects an
    // already-authenticated visitor straight to /dashboard instead of
    // provisioning a redundant demo workspace.
    path: "/try",
    element: <TryPage />,
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
    // Public regardless of auth state, same rationale as /verify-email
    // above: Better Auth's reset-password callback redirects here with no
    // session, but a user could also open the emailed link while still
    // signed in on that browser (e.g. a stale session on this device) and
    // must still be able to complete the reset - GuestRoute would instead
    // bounce them straight to /dashboard before they ever see the form.
    path: "/reset-password",
    element: <ResetPasswordPage />,
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
          {
            path: "/forgot-password",
            element: <ForgotPasswordPage />,
          },
        ],
      },
    ],
  },
];
