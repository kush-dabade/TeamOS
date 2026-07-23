import { createContext, useMemo, type PropsWithChildren } from "react";

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
