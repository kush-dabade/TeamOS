import { createContext, useEffect, useMemo, useRef, type PropsWithChildren } from "react";

import { queryClient } from "@/lib/query-client";
import { authClient } from "@/lib/auth-client";

type AuthStatus = "pending" | "authenticated" | "unauthenticated" | "error";

type SessionData = ReturnType<typeof authClient.useSession>["data"];
type User = NonNullable<SessionData>["user"];

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isPending: boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending, error, refetch } = authClient.useSession();

  let status: AuthStatus;

  if (isPending) {
    status = "pending";
  } else if (error) {
    status = "error";
  } else if (data) {
    status = "authenticated";
  } else {
    status = "unauthenticated";
  }

  const user = data?.user ?? null;
  const isAuthenticated = status === "authenticated";

  // Server-state cache isolation lives on this authenticated -> unauthenticated
  // edge, not on the Sign Out button, so it also fires when Better Auth's
  // cross-tab broadcast (another tab signing out) flips this tab's session to
  // unauthenticated without any local click ever happening. Comparing against
  // the previous status (not just "status === unauthenticated") is what keeps
  // this from clearing on every unauthenticated render, including the very
  // first one before a session has ever been established.
  const previousStatusRef = useRef<AuthStatus>(status);

  useEffect(() => {
    if (previousStatusRef.current === "authenticated" && status === "unauthenticated") {
      queryClient.clear();
    }

    previousStatusRef.current = status;
  }, [status]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated,
      isPending,
      refetch,
    }),
    [user, status, isAuthenticated, isPending, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
