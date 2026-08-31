import { useAuth } from "@/features/auth";

// Better Auth's session/user object includes isDemo/demoExpiresAt at
// runtime (backend/src/lib/auth.ts's user.additionalFields, Commit 5) -
// authClient isn't given a matching generic type parameter (that would
// touch lib/auth-client.ts, a shared file every authenticated page
// depends on, just for a type), so the two fields are widened locally here
// instead, in the one place that reads them. Both are `input: false` on
// the backend, so they can only ever reflect what demo.service.ts itself
// wrote - never anything a client sent.
interface DemoSessionFields {
  isDemo?: boolean;
  demoExpiresAt?: string | Date | null;
}

export interface DemoStatus {
  isDemo: boolean;
  expiresAt: Date | null;
}

export function useDemoStatus(): DemoStatus {
  const { user } = useAuth();
  const demoFields = user as DemoSessionFields | null;

  if (!demoFields?.isDemo) {
    return { isDemo: false, expiresAt: null };
  }

  return {
    isDemo: true,
    expiresAt: demoFields.demoExpiresAt ? new Date(demoFields.demoExpiresAt) : null,
  };
}
