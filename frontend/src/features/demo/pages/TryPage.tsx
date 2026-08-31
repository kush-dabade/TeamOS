import { useCallback, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth";

import { DemoProvisioningError } from "../components/demo-provisioning-error";
import { DemoProvisioningLoader } from "../components/demo-provisioning-loader";
import { useCreateDemoSession } from "../hooks/use-create-demo-session";

export function TryPage() {
  const { status, isAuthenticated, refetch } = useAuth();
  const navigate = useNavigate();
  const createDemoSession = useCreateDemoSession();

  // Guards ONLY the automatic mount-triggered attempt below against firing
  // twice (React StrictMode double-invokes effects in dev) - the "Try
  // again" button calls provision() directly and is deliberately NOT
  // gated by this ref, so a real retry always goes through.
  const hasAutoStartedRef = useRef(false);

  const provision = useCallback(() => {
    createDemoSession.mutate(undefined, {
      onSuccess: async () => {
        // POST /demo/session goes through the shared apiClient (axios), not
        // authClient - Better Auth's own React session store has no way to
        // know the Set-Cookie it just received exists. Without this
        // explicit refetch, AuthenticatedRoute would still read a stale
        // "unauthenticated" status immediately after navigating and bounce
        // straight back to /login despite the browser holding a valid
        // session cookie. login-form.tsx doesn't need this because it
        // calls authClient.signIn.email directly, which updates that same
        // store as a side effect - this call bypasses that path entirely.
        await refetch();
        navigate("/dashboard", { replace: true });
      },
    });
  }, [createDemoSession, navigate, refetch]);

  useEffect(() => {
    // Waits for a definitive answer before provisioning anything - "pending"
    // means useAuth() hasn't finished checking whether this browser already
    // has a real session (handled by the isAuthenticated redirect below,
    // not here). "error" is treated the same as "unauthenticated": if
    // checking prior auth state itself failed, the most useful thing a demo
    // entry point can still do is attempt provisioning anyway rather than
    // strand the visitor on an unrecoverable loading screen.
    if (status === "pending" || status === "authenticated" || hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;
    provision();
  }, [status, provision]);

  // An already-authenticated real user landing on /try should not get a
  // second, unnecessary demo workspace - send them straight into the app
  // they already have access to. Uses the existing auth mechanism
  // (useAuth(), the same one AuthenticatedRoute/GuestRoute already read) -
  // no new authentication check is introduced.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-5">
      {createDemoSession.isError ? (
        <DemoProvisioningError onRetry={provision} isRetrying={createDemoSession.isPending} />
      ) : (
        <DemoProvisioningLoader />
      )}
    </div>
  );
}
