import { createContext, useMemo, type PropsWithChildren } from "react";

import { authClient } from "@/lib/auth-client";

type AuthStatus = "pending" | "authenticated" | "unauthenticated";

type SessionData = ReturnType<typeof authClient.useSession>["data"];
type User = NonNullable<SessionData>["user"];

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isPending: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending } = authClient.useSession();

  let status: AuthStatus;

  if (isPending) {
    status = "pending";
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
    }),
    [user, status, isAuthenticated, isPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
